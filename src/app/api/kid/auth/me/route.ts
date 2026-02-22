import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getAuthenticatedChildId, getAuthenticatedUserId } from "@/lib/session";

export async function GET() {
    try {
        const childIdFromKid = await getAuthenticatedChildId();
        if (childIdFromKid) {
            const child = await prisma.child.findUnique({
                where: { id: childIdFromKid },
                select: { id: true, name: true, age: true },
            });
            if (!child) {
                return NextResponse.json({ error: "Child not found" }, { status: 404 });
            }
            return NextResponse.json({ child, mode: "kid" }, { status: 200 });
        }

        const userId = await getAuthenticatedUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const child = await prisma.child.findFirst({
            where: { userId },
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, age: true },
        });

        if (!child) {
            return NextResponse.json({ error: "No child found" }, { status: 404 });
        }

        return NextResponse.json({ child, mode: "parent" }, { status: 200 });
    } catch (error) {
        console.error("Kid auth me error:", error);
        return NextResponse.json({ error: "Failed to fetch kid session" }, { status: 500 });
    }
}
