"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Login failed");
            }

            router.push("/parent");
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
            <div className="mb-8 flex items-center gap-2">
                <Rocket className="h-8 w-8 text-primary" />
                <span className="text-2xl font-bold tracking-tight">FutureReady</span>
            </div>

            <Card className="w-full max-w-md border-2 border-slate-100 shadow-xl dark:border-slate-800">
                <CardHeader>
                    <CardTitle className="text-2xl">Welcome back</CardTitle>
                    <CardDescription>Enter your credentials to access your dashboard</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-lg border bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 dark:bg-slate-900"
                                placeholder="name@example.com"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-lg border bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 dark:bg-slate-900"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {error && <p className="text-sm font-medium text-red-500">{error}</p>}

                        <Button type="submit" className="w-full h-11" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Log In"}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm">
                        <span className="text-muted-foreground">Don&apos;t have an account? </span>
                        <a href="/signup" className="font-bold text-primary hover:underline">Sign up</a>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
    const getErrorMessage = (error: unknown) => {
        if (error instanceof Error) return error.message;
        return "Login failed";
    };
