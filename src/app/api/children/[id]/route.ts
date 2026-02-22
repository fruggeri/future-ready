import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { getAuthenticatedUserId } from "@/lib/session";

const updateChildSchema = z.object({
    name: z.string().trim().min(1).max(80).optional(),
    age: z.coerce.number().int().min(4).max(18).optional(),
    interests: z.string().trim().max(500).optional().nullable(),
});

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthenticatedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await request.json();
        const { name, age, interests } = updateChildSchema.parse(body);
        const { id: childId } = await params;

        const child = await prisma.child.findFirst({
            where: { id: childId, userId }
        });

        if (!child) return NextResponse.json({ error: "Child not found" }, { status: 404 });

        const updatedChild = await prisma.child.update({
            where: { id: childId },
            data: {
                name,
                age,
                interests: interests === undefined ? undefined : interests,
            }
        });

        return NextResponse.json({ child: updatedChild });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }

        return NextResponse.json({ error: "Failed to update child" }, { status: 500 });
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthenticatedUserId();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id: childId } = await params;

        const child = await prisma.child.findFirst({
            where: { id: childId, userId }
        });

        if (!child) return NextResponse.json({ error: "Child not found" }, { status: 404 });

        // Note: Challenges and XP events should probably be deleted too, 
        // but Prisma cascade delete handles this if configured.
        await prisma.child.delete({
            where: { id: childId }
        });

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: "Failed to delete child" }, { status: 500 });
    }
}
