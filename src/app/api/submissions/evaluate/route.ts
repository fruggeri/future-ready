import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import prisma from "@/lib/prisma";
import { getAuthenticatedChildId, getAuthenticatedUserId } from "@/lib/session";
import { getLevelProgressFromXp } from "@/lib/progression";
import { z } from "zod";

const evaluateSchema = z.object({
    challengeId: z.string().uuid(),
    responseText: z.string().trim().min(1).max(4000),
});

const evaluationOutputSchema = z.object({
    strengths: z.string().trim().min(1),
    improvement_area: z.string().trim().min(1),
    coaching_feedback: z.string().trim().min(1),
    next_step_suggestion: z.string().trim().min(1),
    internal_score: z.number().int().min(1).max(100),
});

function buildFallbackEvaluation(challengePrompt: string, responseText: string) {
    const wordCount = responseText.trim().split(/\s+/).filter(Boolean).length;
    const hasStructure = /because|therefore|so that|first|second|finally|if|then|for example/i.test(responseText);

    const strengths = hasStructure
        ? "You used clear reasoning steps and explained your thinking in a structured way."
        : "You gave a direct answer that stays focused on the challenge topic.";

    const improvementArea = wordCount < 60
        ? "Add more detail and examples to explain your reasoning."
        : "Explain why your strongest idea is the best choice in this challenge.";

    const internalScore = Math.max(65, Math.min(92, 65 + Math.floor(wordCount / 6) + (hasStructure ? 8 : 0)));

    return evaluationOutputSchema.parse({
        strengths,
        improvement_area: improvementArea,
        coaching_feedback: `Nice work on this challenge. You stayed focused on: "${challengePrompt}". Keep building your answer by showing your reasoning step by step and connecting your ideas with examples.`,
        next_step_suggestion: "Revise your response by adding one concrete example and one sentence that starts with 'because' to strengthen your logic.",
        internal_score: internalScore,
    });
}

export async function POST(req: Request) {
    try {
        const authenticatedChildId = await getAuthenticatedChildId();
        const userId = authenticatedChildId ? null : await getAuthenticatedUserId();
        if (!authenticatedChildId && !userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { challengeId, responseText } = evaluateSchema.parse(body);

        const challenge = await prisma.challenge.findUnique({
            where: { id: challengeId },
            include: {
                child: true,
            },
        });

        if (!challenge) {
            return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
        }

        if (authenticatedChildId && challenge.childId !== authenticatedChildId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (userId && challenge.child.userId !== userId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Create submission record
        const submission = await prisma.submission.create({
            data: {
                challengeId,
                responseText,
            },
        });

        let evaluationData;

        try {
            if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith("sk-fake") || process.env.OPENAI_API_KEY === "missing") {
                throw new Error("Missing or placeholder API key");
            }

            const systemPrompt = `You are evaluating a child’s submission for skill development. The child is ${challenge.child.age} years old. 
Domain: ${challenge.domain}. 
Challenge prompt: ${challenge.prompt}. 
Child submission: ${responseText}. 

Provide structured coaching feedback in JSON format with fields: 
- "strengths": What the child did well.
- "improvement_area": One specific area for growth.
- "coaching_feedback": Supportive, narrative feedback addressed to the child.
- "next_step_suggestion": A practical next step for the child to take.
- "internal_score": An evaluation score from 1-100 based on reasoning depth and clarity.

Use a supportive but development-focused tone.`;

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Evaluate the submission and return the JSON." },
                ],
                response_format: { type: "json_object" },
            });

            const content = response.choices[0].message.content;
            if (!content) throw new Error("Failed to generate evaluation content");
            evaluationData = evaluationOutputSchema.parse(JSON.parse(content));
        } catch (error) {
            console.warn("Falling back to mock evaluation:", error);
            evaluationData = buildFallbackEvaluation(challenge.prompt, responseText);
        }

        // Calculate XP awarded (Base XP + score bonus)
        const baseXP = 100;
        const scoreBonus = Math.floor(evaluationData.internal_score / 10) * 10;
        const xpAwarded = baseXP + scoreBonus;

        // Create evaluation record
        const evaluation = await prisma.evaluation.create({
            data: {
                submissionId: submission.id,
                strengths: evaluationData.strengths,
                improvementArea: evaluationData.improvement_area,
                coachingFeedback: evaluationData.coaching_feedback,
                nextStepSuggestion: evaluationData.next_step_suggestion,
                internalScore: evaluationData.internal_score,
                xpAwarded,
            },
        });

        // Create XP event
        await prisma.xPEvent.create({
            data: {
                childId: challenge.childId,
                xpAmount: xpAwarded,
                reason: `Completed ${challenge.domain} challenge`,
            },
        });

        const domainEvaluations = await prisma.submission.findMany({
            where: {
                challenge: {
                    childId: challenge.childId,
                    domain: challenge.domain,
                },
                evaluation: { isNot: null },
            },
            select: {
                evaluation: {
                    select: { xpAwarded: true },
                },
            },
            take: 400,
        });
        const domainXp = domainEvaluations.reduce(
            (sum: number, item: (typeof domainEvaluations)[number]) => sum + (item.evaluation?.xpAwarded || 0),
            0
        );
        const newDomainLevel = getLevelProgressFromXp(domainXp).level;

        const existingChild = await prisma.child.findUnique({
            where: { id: challenge.childId },
            select: { currentLevelsByDomain: true },
        });

        const currentLevelsByDomain = (existingChild?.currentLevelsByDomain || {}) as Record<string, number>;
        currentLevelsByDomain[challenge.domain] = Math.max(currentLevelsByDomain[challenge.domain] || 1, newDomainLevel);

        await prisma.child.update({
            where: { id: challenge.childId },
            data: { currentLevelsByDomain },
        });

        return NextResponse.json({
            evaluation: {
                strengths: evaluation.strengths,
                improvementArea: evaluation.improvementArea,
                coachingFeedback: evaluation.coachingFeedback,
                nextStepSuggestion: evaluation.nextStepSuggestion,
            },
            xpAwarded,
            domainLevel: newDomainLevel,
        });
    } catch (error) {
        console.error("Evaluation error:", error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
