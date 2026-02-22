import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { z } from "zod";

const kidLoginSchema = z.object({
    code: z.string().trim().min(4).max(12),
});

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { code } = kidLoginSchema.parse(body);

        const normalizedCode = code.toUpperCase();
        const child = await prisma.child.findFirst({
            where: { kidAccessCode: normalizedCode },
            select: { id: true, name: true },
        });

        if (!child) {
            return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
        }

        const token = signToken({ childId: child.id, role: "kid" });
        const response = NextResponse.json({ child }, { status: 200 });
        response.cookies.set("kid-token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 14,
            path: "/",
        });

        return response;
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues }, { status: 400 });
        }
        console.error("Kid login error:", error);
        return NextResponse.json({ error: "Failed to login kid session" }, { status: 500 });
    }
}
