import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/session";
import { z } from "zod";

const generateSchema = z.object({
    childId: z.string().uuid(),
    skillDomain: z.string(),
    level: z.number().min(1).max(10),
    interests: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { childId, skillDomain, level, interests } = generateSchema.parse(body);

        const child = await prisma.child.findFirst({
            where: { id: childId, userId },
        });

        if (!child) {
            return NextResponse.json({ error: "Child not found" }, { status: 404 });
        }

        const interestString = interests && interests.length > 0 ? ` with interests in ${interests.join(", ")}` : "";

        const systemPrompt = `You are designing a skill-building challenge for a ${child.age}-year-old child focused on the domain: ${skillDomain}${interestString}. The current skill level is ${level}. 
Return a JSON object with:
- "prompt": A 10–15 minute challenge that encourages reasoning, creativity, and structured thinking. Clear and age-appropriate.
- "expected_reasoning": A brief description of the reasoning depth expected from the child at this age and level.
- "rubric": General evaluation criteria for this specific challenge.
Do not include answers.`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Generate the challenge JSON." },
            ],
            response_format: { type: "json_object" },
        });

        const content = response.choices[0].message.content;
        if (!content) {
            throw new Error("Failed to generate challenge content");
        }

        const challengeData = JSON.parse(content);

        const challenge = await prisma.challenge.create({
            data: {
                childId,
                domain: skillDomain,
                level,
                prompt: challengeData.prompt,
            },
        });

        return NextResponse.json({
            id: challenge.id,
            prompt: challenge.prompt,
            expectedReasoning: challengeData.expected_reasoning,
            rubric: challengeData.rubric,
        });
    } catch (error) {
        console.error("Challenge generation error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
