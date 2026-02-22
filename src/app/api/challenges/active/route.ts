import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedChildId, getAuthenticatedUserId } from "@/lib/session";
import { getLevelProgressFromXp } from "@/lib/progression";
import { z } from "zod";
import { FOCUS_DOMAINS } from "@/lib/focus-domains";

const childQuerySchema = z.object({
    childId: z.string().uuid().optional(),
});

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const parsedQuery = childQuerySchema.safeParse({
            childId: url.searchParams.get("childId") || undefined,
        });
        const requestedChildId = parsedQuery.success ? parsedQuery.data.childId : undefined;

        const authenticatedChildId = await getAuthenticatedChildId();
        const userId = authenticatedChildId ? null : await getAuthenticatedUserId();
        if (!authenticatedChildId && !userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        let child;
        if (authenticatedChildId) {
            child = await prisma.child.findUnique({
                where: { id: authenticatedChildId },
                include: { xpEvents: { select: { xpAmount: true } } },
            });
        } else if (requestedChildId) {
            child = await prisma.child.findFirst({
                where: { id: requestedChildId, userId: userId! },
                include: { xpEvents: { select: { xpAmount: true } } },
            });
        } else {
            child = await prisma.child.findFirst({
                where: { userId: userId! },
                orderBy: { createdAt: "asc" },
                include: { xpEvents: { select: { xpAmount: true } } },
            });
        }

        if (!child) {
            return NextResponse.json({ error: "No child profile found" }, { status: 404 });
        }

        let activeChallenge = await prisma.challenge.findFirst({
            where: {
                childId: child.id,
                submissions: {
                    none: {},
                },
            },
            orderBy: { createdAt: "asc" },
        });

        if (!activeChallenge) {
            const templates = await prisma.challengeTemplate.findMany({
                where: {
                    ageMin: { lte: child.age },
                    ageMax: { gte: child.age },
                },
                orderBy: { sortOrder: "asc" },
            });

            if (templates.length === 0) {
                return NextResponse.json({ error: "No challenge templates configured for this age" }, { status: 404 });
            }

            const completedAndAssignedCount = await prisma.challenge.count({
                where: { childId: child.id },
            });
            const nextTemplate = templates[completedAndAssignedCount % templates.length];

            activeChallenge = await prisma.challenge.create({
                data: {
                    childId: child.id,
                    domain: nextTemplate.domain,
                    level: nextTemplate.level,
                    prompt: nextTemplate.prompt,
                },
            });
        }
        const totalXp = child.xpEvents.reduce(
            (sum: number, event: { xpAmount: number }) => sum + event.xpAmount,
            0
        );
        const levelProgress = getLevelProgressFromXp(totalXp);

        const recentSubmissions = await prisma.submission.findMany({
            where: {
                challenge: { childId: child.id },
            },
            orderBy: { createdAt: "desc" },
            take: 6,
            include: {
                challenge: {
                    select: { id: true, domain: true, level: true, prompt: true },
                },
                evaluation: {
                    select: {
                        strengths: true,
                        coachingFeedback: true,
                        nextStepSuggestion: true,
                        xpAwarded: true,
                        internalScore: true,
                    },
                },
            },
        });

        const allEvaluated = await prisma.submission.findMany({
            where: {
                challenge: { childId: child.id },
                evaluation: { isNot: null },
            },
            select: {
                challenge: { select: { domain: true } },
                evaluation: { select: { xpAwarded: true } },
            },
            take: 400,
            orderBy: { createdAt: "desc" },
        });

        const domainXp: Record<string, number> = {};
        for (const entry of allEvaluated) {
            const domain = entry.challenge.domain;
            domainXp[domain] = (domainXp[domain] || 0) + (entry.evaluation?.xpAwarded || 0);
        }
        const activeDomainXp = domainXp[activeChallenge.domain] || 0;
        const activeDomainLevelProgress = getLevelProgressFromXp(activeDomainXp);
        const allDomainProgress = FOCUS_DOMAINS.map((focusDomain) => {
            const domainName = focusDomain.name;
            const progress = getLevelProgressFromXp(domainXp[domainName] || 0);
            return {
                domain: domainName,
                level: progress.level,
                xpIntoLevel: progress.xpIntoLevel,
                xpForNextLevel: progress.xpForNextLevel,
                progressPercent: progress.progressPercent,
            };
        });

        return NextResponse.json({
            child: {
                id: child.id,
                name: child.name,
                age: child.age,
                xp: totalXp,
                level: levelProgress.level,
                xpIntoLevel: levelProgress.xpIntoLevel,
                xpForNextLevel: levelProgress.xpForNextLevel,
                progressPercent: levelProgress.progressPercent,
                currentLevelsByDomain: child.currentLevelsByDomain,
            },
            challenge: {
                id: activeChallenge.id,
                domain: activeChallenge.domain,
                level: activeChallenge.level,
                prompt: activeChallenge.prompt,
            },
            domainProgress: {
                domain: activeChallenge.domain,
                level: activeDomainLevelProgress.level,
                xpIntoLevel: activeDomainLevelProgress.xpIntoLevel,
                xpForNextLevel: activeDomainLevelProgress.xpForNextLevel,
                progressPercent: activeDomainLevelProgress.progressPercent,
            },
            allDomainProgress,
            recentWork: recentSubmissions.map((submission) => ({
                id: submission.id,
                createdAt: submission.createdAt,
                responseText: submission.responseText,
                challenge: submission.challenge,
                evaluation: submission.evaluation,
            })),
        });
    } catch (error) {
        console.error("Active challenge fetch error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
