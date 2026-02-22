import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

type AuthTokenPayload = {
    userId?: string;
    email?: string;
    childId?: string;
    role: "parent" | "kid";
};

function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }

    return secret;
}

export const hashPassword = async (password: string) => {
    return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hash: string) => {
    return await bcrypt.compare(password, hash);
};

export const signToken = (payload: AuthTokenPayload) => {
    return jwt.sign(payload, getJwtSecret(), { expiresIn: "7d" });
};

export const verifyToken = (token: string) => {
    try {
        return jwt.verify(token, getJwtSecret());
    } catch {
        return null;
    }
};
