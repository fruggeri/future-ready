import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

type AuthPayload = {
    userId?: string;
    childId?: string;
    role?: "parent" | "kid";
    email?: string;
    iat?: number;
    exp?: number;
};

export async function getAuthenticatedUserId() {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-token")?.value;

    if (!token) {
        return null;
    }

    const decoded = verifyToken(token);
    if (!decoded || typeof decoded !== "object") {
        return null;
    }

    const payload = decoded as AuthPayload;
    if (payload.role !== "parent" || !payload.userId || typeof payload.userId !== "string") {
        return null;
    }

    return payload.userId;
}

export async function getAuthenticatedChildId() {
    const cookieStore = await cookies();
    const token = cookieStore.get("kid-token")?.value;

    if (!token) {
        return null;
    }

    const decoded = verifyToken(token);
    if (!decoded || typeof decoded !== "object") {
        return null;
    }

    const payload = decoded as AuthPayload;
    if (payload.role !== "kid" || !payload.childId || typeof payload.childId !== "string") {
        return null;
    }

    return payload.childId;
}
