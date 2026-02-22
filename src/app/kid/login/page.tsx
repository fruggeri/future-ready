"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";

export default function KidLoginPage() {
    const router = useRouter();
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/kid/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Invalid code");
            }

            router.push("/kid");
        } catch (err) {
            if (err instanceof Error) setError(err.message);
            else setError("Could not log in");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,#dbeafe_0%,#f0f9ff_35%,#fefce8_100%)] flex items-center justify-center p-4">
            <Card className="w-full max-w-md border-2 border-sky-100 shadow-2xl rounded-3xl overflow-hidden">
                <CardHeader className="text-center bg-gradient-to-r from-sky-50 to-cyan-50">
                    <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
                        <Rocket className="h-6 w-6" />
                    </div>
                    <CardTitle className="text-3xl">Kid Login</CardTitle>
                    <CardDescription>Type the 6-letter code your parent gave you.</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold">Access Code</label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                                    className="w-full rounded-xl border-2 border-sky-200 bg-white pl-10 pr-4 py-3 text-xl tracking-[0.3em] font-bold uppercase outline-none focus:border-primary"
                                    maxLength={8}
                                    placeholder="ABC123"
                                    required
                                />
                            </div>
                        </div>

                        {error ? <p className="text-sm font-medium text-red-500">{error}</p> : null}

                        <Button type="submit" className="w-full h-12 text-lg rounded-xl" disabled={loading}>
                            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Start Challenge"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
