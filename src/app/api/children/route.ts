import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/session";
import { generateKidAccessCode } from "@/lib/access-code";
import { createInitialDomainLevels } from "@/lib/focus-domains";

const createChildSchema = z.object({
    name: z.string().trim().min(1).max(80),
    age: z.coerce.number().int().min(4).max(18),
    interests: z.string().trim().max(500).optional().nullable(),
});

export async function GET() {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const children = await prisma.child.findMany({
            where: { userId },
            include: {
                challenges: {
                    orderBy: { createdAt: "desc" },
                    take: 5,
                    include: {
                        submissions: {
                            orderBy: { createdAt: "desc" },
                            take: 1,
                            include: {
                                evaluation: true,
                            },
                        },
                    },
                }
            }
        });

        return NextResponse.json({ children });
    } catch {
        return NextResponse.json({ error: "Failed to fetch children" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, age, interests } = createChildSchema.parse(body);

        let kidAccessCode: string | null = null;
        for (let i = 0; i < 8; i += 1) {
            const candidate = generateKidAccessCode();
            const existing = await prisma.child.findFirst({
                where: { kidAccessCode: candidate },
                select: { id: true },
            });
            if (!existing) {
                kidAccessCode = candidate;
                break;
            }
        }

        if (!kidAccessCode) {
            return NextResponse.json({ error: "Failed to generate kid access code" }, { status: 500 });
        }

        const child = await prisma.child.create({
            data: {
                userId,
                name,
                age,
                kidAccessCode,
                interests: interests ?? null,
                currentLevelsByDomain: createInitialDomainLevels(1),
            }
        });

        return NextResponse.json({ child }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }

        console.error("Failed to create child:", error);
        return NextResponse.json({ error: "Failed to create child profile" }, { status: 500 });
    }
}
