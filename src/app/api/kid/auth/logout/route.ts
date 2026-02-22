import { NextResponse } from "next/server";

export async function POST() {
    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.cookies.set("kid-token", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: new Date(0),
        path: "/",
    });
    return response;
}
