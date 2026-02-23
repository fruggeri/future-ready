import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getAuthenticatedUserId } from "@/lib/session";

type RecentActivitySubmission = Prisma.SubmissionGetPayload<{
    include: {
        challenge: {
            select: {
                id: true;
                domain: true;
                level: true;
                prompt: true;
                child: {
                    select: {
                        id: true;
                        name: true;
                    };
                };
            };
        };
        evaluation: {
            select: {
                strengths: true;
                improvementArea: true;
                coachingFeedback: true;
                nextStepSuggestion: true;
                xpAwarded: true;
                internalScore: true;
            };
        };
    };
}>;

export async function GET() {
    try {
        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const submissions: RecentActivitySubmission[] = await prisma.submission.findMany({
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

        const activity = submissions.map((submission: RecentActivitySubmission) => ({
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
