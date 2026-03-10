import { NextResponse } from "next/server";
import { z } from "zod";

import { buildBoardChatContext } from "@/lib/board-search";
import { searchBoardAttachmentsOpenAI } from "@/lib/board-openai-search";
import { openai } from "@/lib/openai";

const messageSchema = z.object({
  message: z.string().min(1),
  meetingId: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .max(8)
    .optional(),
});

export async function POST(request: Request) {
  try {
    const body = messageSchema.parse(await request.json());
    const localContext = buildBoardChatContext(body.message, body.meetingId);
    const attachmentHits = await searchBoardAttachmentsOpenAI(body.message, body.meetingId, 6).catch(() => []);
    const attachmentContext = attachmentHits
      .map(
        (hit, index) =>
          `[A${index + 1}] Attachment: ${hit.fileName}\nAgenda Item: ${hit.itemTitle}\nExcerpt: ${hit.snippet}`,
      )
      .join("\n\n");

    const hits = [...localContext.hits.slice(0, 5), ...attachmentHits.slice(0, 5)].slice(0, 10);
    const context = [localContext.context, attachmentContext].filter(Boolean).join("\n\n");

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "missing") {
      return NextResponse.json({
        answer: context
          ? `I found relevant meeting context, but the OpenAI API key is missing. Top sources:\n\n${context}`
          : "I could not find relevant meeting content for that question.",
        citations: hits,
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You answer questions about imported school board meeting archives. Use only the provided context. If the context is insufficient, say so plainly. Prefer concise answers with specific supporting references to agenda items or attachments.",
        },
        ...((body.history ?? []).map((entry) => ({
          role: entry.role,
          content: entry.content,
        })) as Array<{ role: "user" | "assistant"; content: string }>),
        {
          role: "user",
          content: `Question: ${body.message}\n\nMeeting context:\n${context || "No relevant context found."}`,
        },
      ],
    });

    const answer = response.choices[0]?.message?.content ?? "I could not generate an answer.";

    return NextResponse.json({
      answer,
      citations: hits,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Chat request failed.";
    return NextResponse.json({ error: message, answer: "Chat request failed.", citations: [] }, { status: 400 });
  }
}
