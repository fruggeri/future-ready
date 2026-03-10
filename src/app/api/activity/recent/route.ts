import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/session";

export async function GET() {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const submissions = await prisma.submission.findMany({
            where: {
                challenge: {
                    child: {
                        userId,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            take: 30,
            include: {
                challenge: {
                    select: {
                        id: true,
                        domain: true,
                        level: true,
                        prompt: true,
                        child: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                },
                evaluation: {
                    select: {
                        strengths: true,
                        improvementArea: true,
                        coachingFeedback: true,
                        nextStepSuggestion: true,
                        xpAwarded: true,
                        internalScore: true,
                    },
                },
            },
        });

        const activity = submissions.map((submission: (typeof submissions)[number]) => ({
            id: submission.id,
            createdAt: submission.createdAt,
            responseText: submission.responseText,
            domain: submission.challenge.domain,
            level: submission.challenge.level,
            challengeId: submission.challenge.id,
            challengePrompt: submission.challenge.prompt,
            childId: submission.challenge.child.id,
            childName: submission.challenge.child.name,
            evaluation: submission.evaluation,
        }));

        return NextResponse.json({ activity }, { status: 200 });
    } catch (error) {
        console.error("Recent activity fetch error:", error);
        return NextResponse.json({ error: "Failed to fetch recent activity" }, { status: 500 });
    }
}
