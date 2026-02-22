"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function SignupPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Signup failed");
            }

            router.push("/parent");
        } catch (err: unknown) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-12">
            <div className="mb-8 flex items-center gap-2">
                <Rocket className="h-8 w-8 text-primary" />
                <span className="text-2xl font-bold tracking-tight">FutureReady</span>
            </div>

            <div className="grid gap-8 lg:grid-cols-2 lg:max-w-4xl w-full">
                <div className="flex flex-col justify-center space-y-6">
                    <h1 className="text-4xl font-extrabold tracking-tight">Prepare your family for the AI era.</h1>
                    <p className="text-lg text-muted-foreground">Join thousands of proactive parents building the essential cognitive skills for the next generation.</p>

                    <ul className="space-y-4">
                        {[
                            "Weekly AI-generated skill challenges",
                            "Real-time narrative coaching feedback",
                            "Parent dashboard with deep analytics",
                            "Tailored growth plans based on interests"
                        ].map((text, i) => (
                            <li key={i} className="flex items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                <span className="font-medium text-slate-700 dark:text-slate-300">{text}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <Card className="border-2 border-slate-100 shadow-xl dark:border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-2xl">Create your account</CardTitle>
                        <CardDescription>Start your 7-day free trial today</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSignup} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Full Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full rounded-lg border bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 dark:bg-slate-900"
                                    placeholder="John Doe"
                                    required
                                />
                            </div>
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

                            <Button type="submit" className="w-full h-11 text-lg font-bold" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Sign Up"}
                            </Button>
                        </form>

                        <div className="mt-6 text-center text-sm">
                            <span className="text-muted-foreground">Already have an account? </span>
                            <a href="/login" className="font-bold text-primary hover:underline">Log in</a>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
    const getErrorMessage = (error: unknown) => {
        if (error instanceof Error) return error.message;
        return "Signup failed";
    };
