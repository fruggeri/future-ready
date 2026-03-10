import { NextResponse } from "next/server";

import { searchBoardArchive } from "@/lib/board-search";
import { searchBoardAttachmentsOpenAI } from "@/lib/board-openai-search";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const meetingId = searchParams.get("meetingId")?.trim() || undefined;

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    const [agendaResults, attachmentResults] = await Promise.all([
      Promise.resolve(searchBoardArchive(query, meetingId)),
      searchBoardAttachmentsOpenAI(query, meetingId).catch(() => []),
    ]);

    const results = [...agendaResults.slice(0, 8), ...attachmentResults.slice(0, 8)].slice(0, 16);
    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";
    return NextResponse.json({ error: message, results: [] }, { status: 500 });
  }
}
