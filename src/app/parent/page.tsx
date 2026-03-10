"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
    TrendingUp,
    MessageCircle,
    ChevronRight,
    Plus,
    Bell,
    LogOut,
    Loader2,
    X,
    Sparkles,
    Trophy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { FOCUS_DOMAINS } from "@/lib/focus-domains";

type User = {
    id: string;
    email: string;
    name: string | null;
    plan: string;
};

type Child = {
    id: string;
    userId: string;
    name: string;
    age: number;
    kidAccessCode: string | null;
    interests: string | null;
    currentLevelsByDomain: Record<string, number>;
};

type ChildCreateResponse = {
    child: Child;
    error?: string;
};

type Evaluation = {
    strengths: string;
    improvementArea: string;
    coachingFeedback: string;
    nextStepSuggestion: string;
    xpAwarded: number;
    internalScore: number;
};

type RecentActivityItem = {
    id: string;
    childId: string;
    childName: string;
    challengeId: string;
    challengePrompt: string;
    domain: string;
    level: number;
    responseText: string;
    createdAt: string;
    evaluation: Evaluation | null;
};

type RecentActivityResponse = {
    activity: RecentActivityItem[];
};

function getErrorMessage(error: unknown, fallback: string) {
    if (error instanceof Error) return error.message;
    return fallback;
}

function formatDateTime(value: string) {
    const date = new Date(value);
    return date.toLocaleString();
}

export default function ParentDashboard() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [childrenList, setChildrenList] = useState<Child[]>([]);
    const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
    const [selectedActivity, setSelectedActivity] = useState<RecentActivityItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddChild, setShowAddChild] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    // Auth and Data Fetching
    useEffect(() => {
        async function init() {
            try {
                const userRes = await fetch("/api/auth/me");
                if (!userRes.ok) {
                    setShowPreview(true);
                    return;
                }
                const userData = await userRes.json();
                setUser(userData.user);

                const childrenRes = await fetch("/api/children");
                const childrenData = await childrenRes.json();
                setChildrenList(childrenData.children || []);

                const activityRes = await fetch("/api/activity/recent");
                const activityData = (await activityRes.json()) as RecentActivityResponse;
                setRecentActivity((activityData.activity || []).slice(0, 8));
            } catch (error) {
                console.error("Dashboard init error:", error);
            } finally {
                setLoading(false);
            }
        }
        init();
    }, [router]);

    const childStats = new Map(
        childrenList.map((child) => {
            const activityForChild = recentActivity.filter((item) => item.childId === child.id);
            const evaluations = activityForChild
                .map((item) => item.evaluation)
                .filter((evaluation): evaluation is Evaluation => Boolean(evaluation));
            const totalXp = evaluations.reduce(
                (sum: number, evaluation: Evaluation) => sum + evaluation.xpAwarded,
                0
            );
            const averageScore = evaluations.length > 0
                ? Math.round(
                    evaluations.reduce(
                        (sum: number, evaluation: Evaluation) => sum + evaluation.internalScore,
                        0
                    ) / evaluations.length
                )
                : null;

            return [child.id, {
                completedCount: activityForChild.length,
                totalXp,
                averageScore,
            }];
        })
    );

    const hasAnalytics = recentActivity.length > 0;

    const handleLogout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_15%_10%,#dbeafe_0%,#f8fafc_50%,#fef3c7_100%)]">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    if (showPreview) {
        return (
            <div className="min-h-screen bg-[radial-gradient(circle_at_15%_10%,#dbeafe_0%,#f8fafc_50%,#fef3c7_100%)]">
                <main className="container mx-auto max-w-5xl px-4 py-10">
                    <Card className="mb-8 overflow-hidden border-2 border-sky-100 bg-white/95 shadow-xl">
                        <CardContent className="grid gap-6 p-6 md:grid-cols-2 md:items-center">
                            <div className="space-y-4">
                                <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">Parent Experience Preview</Badge>
                                <h1 className="text-3xl font-black tracking-tight text-slate-900">See your family dashboard before signing in</h1>
                                <p className="text-slate-600">Track child progress across all 6 focus areas, review every response, and see AI coaching feedback.</p>
                                <div className="flex flex-wrap gap-3">
                                    <Button asChild className="rounded-full px-6">
                                        <a href="/signup">Create Parent Account</a>
                                    </Button>
                                    <Button asChild variant="outline" className="rounded-full px-6">
                                        <a href="/login">Log In</a>
                                    </Button>
                                </div>
                            </div>
                            <div className="overflow-hidden rounded-2xl border bg-slate-50 shadow-md">
                                <Image
                                    src="/walkthrough/parent_overview.png"
                                    alt="Parent dashboard preview"
                                    width={1100}
                                    height={720}
                                    className="h-full w-full object-cover"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid gap-4 md:grid-cols-2">
                        <Card className="overflow-hidden border-2 border-sky-100 bg-white/95">
                            <CardHeader>
                                <CardTitle className="text-lg">Recent Activity + Submission Details</CardTitle>
                                <CardDescription>Open any entry to see the question, child answer, and full AI feedback.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-hidden rounded-xl border">
                                    <Image
                                        src="/walkthrough/parent_overview.png"
                                        alt="Parent activity detail preview"
                                        width={1000}
                                        height={680}
                                        className="h-52 w-full object-cover"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="overflow-hidden border-2 border-amber-100 bg-white/95">
                            <CardHeader>
                                <CardTitle className="text-lg">Conversation Starter Panel</CardTitle>
                                <CardDescription>Bridge challenge work to family discussions in minutes.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-hidden rounded-xl border">
                                    <Image
                                        src="/walkthrough/parent_starters.png"
                                        alt="Parent conversation starter preview"
                                        width={1000}
                                        height={680}
                                        className="h-52 w-full object-cover"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_15%_10%,#dbeafe_0%,#f8fafc_50%,#fef3c7_100%)]">
            <main className="container mx-auto px-4 py-8 md:px-6">
                <Card className="mb-8 overflow-hidden border-2 border-sky-100 bg-white/95 shadow-xl">
                    <CardContent className="grid gap-6 p-5 md:grid-cols-[1.1fr_0.9fr] md:p-7">
                        <div className="space-y-4">
                            <Badge variant="secondary" className="w-fit rounded-full px-3 py-1 text-xs font-bold">
                                Parent Mission Control
                            </Badge>
                            <div>
                                <h1 className="text-3xl font-black tracking-tight text-slate-900">Family Overview</h1>
                                <p className="mt-1 text-slate-600">Welcome back, {user?.name || user?.email}.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <Button className="rounded-full px-6 font-semibold" onClick={() => setShowAddChild(true)}>
                                    <Plus className="mr-2 h-4 w-4" /> Add Child
                                </Button>
                                <Button variant="outline" className="rounded-full" size="sm">
                                    <Bell className="mr-2 h-4 w-4" /> Alerts
                                </Button>
                                <Button variant="outline" className="rounded-full" size="sm" onClick={handleLogout} title="Log Out">
                                    <LogOut className="mr-2 h-4 w-4" /> Log Out
                                </Button>
                            </div>
                        </div>
                        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-50 via-white to-amber-50 p-4">
                            <div className="absolute -top-4 -right-4 h-20 w-20 rounded-full bg-sky-200/70 blur-2xl" />
                            <div className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-amber-200/80 blur-2xl" />
                            <div className="relative space-y-3">
                                <p className="text-xs font-bold uppercase tracking-wider text-primary">What parents can do here</p>
                                <div className="space-y-2 text-sm font-medium text-slate-700">
                                    <p className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" /> Review each child answer with AI feedback</p>
                                    <p className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-500" /> Track XP, levels, and challenge consistency</p>
                                    <p className="flex items-center gap-2"><Trophy className="h-4 w-4 text-blue-500" /> Guide kids toward the next meaningful milestone</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* Main Content */}
                    <div className="md:col-span-2 space-y-6">
                        {childrenList.length === 0 ? (
                            <Card className="border-dashed border-2 p-12 text-center">
                                <CardTitle className="mb-4">No children added yet</CardTitle>
                                <CardDescription className="mb-6">Add your first child profile to start tracking their AI-ready skills.</CardDescription>
                                <Button variant="outline" onClick={() => setShowAddChild(true)}>
                                    <Plus className="mr-2 h-4 w-4" /> Add Child Profile
                                </Button>
                            </Card>
                        ) : (
                            childrenList.map((child) => (
                                <Card key={child.id} className="overflow-hidden border-2 border-sky-100/80 bg-white/95 shadow-md transition-all hover:border-primary/25 hover:shadow-lg">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 bg-gradient-to-r from-white via-sky-50/45 to-amber-50/35">
                                        <div className="flex items-center gap-4">
                                            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-500 to-cyan-400 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-blue-500/20">
                                                {child.name[0]}
                                            </div>
                                            <div>
                                                <CardTitle className="text-2xl">{child.name}</CardTitle>
                                                <CardDescription className="text-lg">Age {child.age} • AI Explorer</CardDescription>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    Kid login code: <span className="font-bold tracking-widest text-foreground">{child.kidAccessCode || "Generating..."}</span>
                                                    {" "}• <a href="/kid/login" className="underline">Open kid login</a>
                                                </p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5 px-4 py-1 font-bold text-base">
                                            Ready for next challenge
                                        </Badge>
                                    </CardHeader>
                                    <CardContent className="space-y-6 border-t bg-slate-50/65 pt-6">
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <div className="rounded-xl border bg-white p-3 text-sm shadow-sm">
                                                <p className="text-muted-foreground">Completed</p>
                                                <p className="text-lg font-bold">{childStats.get(child.id)?.completedCount ?? 0}</p>
                                            </div>
                                            <div className="rounded-xl border bg-white p-3 text-sm shadow-sm">
                                                <p className="text-muted-foreground">Earned XP</p>
                                                <p className="text-lg font-bold">{childStats.get(child.id)?.totalXp ?? 0}</p>
                                            </div>
                                            <div className="rounded-xl border bg-white p-3 text-sm shadow-sm">
                                                <p className="text-muted-foreground">Avg Score</p>
                                                <p className="text-lg font-bold">
                                                    {childStats.get(child.id)?.averageScore ?? "N/A"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                            {FOCUS_DOMAINS.map((focusDomain) => {
                                                const level = Number((child.currentLevelsByDomain as Record<string, unknown>)[focusDomain.name] || 1);
                                                return (
                                                <div key={focusDomain.name} className="space-y-2">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="font-semibold">{focusDomain.name}</span>
                                                        <span className="text-muted-foreground font-medium">Lvl {level}</span>
                                                    </div>
                                                    <Progress value={(level / 10) * 100} className="h-2 shadow-inner" />
                                                </div>
                                            );
                                            })}
                                        </div>
                                        <div className="pt-4">
                                            <Button
                                                variant="outline"
                                                className="w-full h-11 text-base font-medium border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 transition-all"
                                                onClick={() => {
                                                    const section = document.getElementById("recent-activity");
                                                    section?.scrollIntoView({ behavior: "smooth", block: "start" });
                                                }}
                                            >
                                                {hasAnalytics ? "View Deep Dive Analytics" : "Complete A Challenge To Unlock Analytics"}
                                                <ChevronRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}

                        <Card id="recent-activity" className="overflow-hidden border-2 border-sky-100/80 bg-white/95 shadow-md">
                            <CardHeader>
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <TrendingUp className="h-6 w-6 text-green-500" /> Recent Activity
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {recentActivity.length === 0 ? (
                                    <div className="divide-y border-t text-center py-12 text-muted-foreground">
                                        <p>Activity will appear here once your children complete challenges.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y border-t">
                                        {recentActivity.map((activity) => (
                                            <button
                                                key={activity.id}
                                                type="button"
                                                className="w-full space-y-2 p-5 text-left transition hover:bg-sky-50/40"
                                                onClick={() => setSelectedActivity(activity)}
                                            >
                                                <div className="flex items-center justify-between gap-4">
                                                    <p className="font-semibold">
                                                        {activity.childName} completed a {activity.domain} challenge
                                                    </p>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatDateTime(activity.createdAt)}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-muted-foreground line-clamp-2">
                                                    <span className="font-medium text-foreground">Child response:</span> {activity.responseText}
                                                </p>
                                                {activity.evaluation ? (
                                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                                        <span className="font-medium text-foreground">AI coaching:</span> {activity.evaluation.coachingFeedback}
                                                    </p>
                                                ) : null}
                                                <p className="text-xs font-semibold text-primary">Click to view full submission</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <Card className="group relative overflow-hidden border-none bg-primary text-primary-foreground shadow-xl shadow-primary/20">
                            <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                                <MessageCircle size={120} />
                            </div>
                            <CardHeader className="relative z-10">
                                <CardTitle className="text-xl flex items-center gap-2">
                                    <MessageCircle className="h-6 w-6" /> Conversation Starter
                                </CardTitle>
                                <CardDescription className="text-primary-foreground/90 mt-2 text-base font-medium">
                                    Connect with your family:
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="relative z-10">
                                <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                                    <p className="italic font-bold text-xl leading-relaxed">
                                        &quot;Ask your child what they think would happen if AI could understand how animals feel.&quot;
                                    </p>
                                </div>
                                <Button variant="secondary" className="w-full mt-6 h-12 text-base font-bold bg-white text-primary hover:bg-white/95 border-none shadow-lg">
                                    More Starters
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-2 border-sky-100/80 bg-white/95 shadow-md">
                            <CardHeader>
                                <CardTitle className="text-lg">Screen Preview</CardTitle>
                                <CardDescription>What kids and parents see each session.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="overflow-hidden rounded-xl border">
                                    <Image
                                        src="/walkthrough/kid_feedback.png"
                                        alt="Kid feedback screen preview"
                                        width={640}
                                        height={420}
                                        className="h-36 w-full object-cover"
                                    />
                                </div>
                                <div className="overflow-hidden rounded-xl border">
                                    <Image
                                        src="/walkthrough/parent_starters.png"
                                        alt="Parent conversation starters preview"
                                        width={640}
                                        height={420}
                                        className="h-36 w-full object-cover"
                                    />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-2 border-slate-100 dark:border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-lg">Family Plan</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                                    <span className="font-bold">{user?.plan === "BETA" ? "Beta Early Access" : "Standard Plan"}</span>
                                    <Badge className="bg-green-500 hover:bg-green-600 border-none font-bold">
                                        {user?.plan === "BETA" ? "$29/mo" : "$39/mo"}
                                    </Badge>
                                </div>
                                <Button variant="outline" className="w-full h-11 text-base font-medium border-slate-200 hover:bg-slate-50 transition-all">
                                    Manage Billing
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>

            {/* Add Child Modal */}
            <AnimatePresence>
                {showAddChild && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <AddChildForm
                                onCancel={() => setShowAddChild(false)}
                                onSuccess={(newChild) => {
                                    setChildrenList([...childrenList, newChild]);
                                    setShowAddChild(false);
                                }}
                            />
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {selectedActivity ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b flex items-center justify-between">
                                <h3 className="text-xl font-bold">
                                    {selectedActivity.childName} • {selectedActivity.domain} (L{selectedActivity.level})
                                </h3>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedActivity(null)}>Close</Button>
                            </div>
                            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                                <div className="text-xs text-muted-foreground">{formatDateTime(selectedActivity.createdAt)}</div>
                                <div className="space-y-2">
                                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Question</p>
                                    <p className="text-base leading-relaxed">{selectedActivity.challengePrompt}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Child Answer</p>
                                    <p className="text-base leading-relaxed whitespace-pre-wrap">{selectedActivity.responseText}</p>
                                </div>
                                {selectedActivity.evaluation ? (
                                    <div className="space-y-3">
                                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">AI Feedback</p>
                                        <div className="rounded-xl border bg-blue-50 dark:bg-blue-900/20 p-3">
                                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">Strengths</p>
                                            <p className="text-sm leading-relaxed">{selectedActivity.evaluation.strengths}</p>
                                        </div>
                                        <div className="rounded-xl border bg-violet-50 dark:bg-violet-900/20 p-3">
                                            <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-1">Coaching</p>
                                            <p className="text-sm leading-relaxed">{selectedActivity.evaluation.coachingFeedback}</p>
                                        </div>
                                        <div className="rounded-xl border bg-amber-50 dark:bg-amber-900/20 p-3">
                                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Next Step</p>
                                            <p className="text-sm leading-relaxed">{selectedActivity.evaluation.nextStepSuggestion}</p>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm">
                                            <Badge variant="secondary">XP +{selectedActivity.evaluation.xpAwarded}</Badge>
                                            <Badge variant="outline">Score {selectedActivity.evaluation.internalScore}</Badge>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No evaluation has been generated for this submission yet.</p>
                                )}
                            </div>
                        </motion.div>
                    </div>
                ) : null}
            </AnimatePresence>
        </div>
    );
}

function AddChildForm({ onCancel, onSuccess }: { onCancel: () => void, onSuccess: (child: Child) => void }) {
    const [name, setName] = useState("");
    const [age, setAge] = useState("");
    const [interests, setInterests] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/children", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, age, interests }),
            });

            const data = (await res.json()) as ChildCreateResponse;

            if (!res.ok) throw new Error(data.error || "Failed to add child");

            onSuccess(data.child);
        } catch (err: unknown) {
            setError(getErrorMessage(err, "Failed to add child"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="p-6 border-b flex justify-between items-center">
                <h3 className="text-xl font-bold">Add Child Profile</h3>
                <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="h-6 w-6" />
                </button>
            </div>
            <div className="p-6 space-y-4">
                <div className="space-y-1">
                    <label className="text-sm font-medium">Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg border bg-slate-50 dark:bg-slate-800 px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        placeholder="Alex"
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">Age</label>
                    <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="w-full rounded-lg border bg-slate-50 dark:bg-slate-800 px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                        placeholder="12"
                        required
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-sm font-medium">Interests (Optional)</label>
                    <textarea
                        value={interests}
                        onChange={(e) => setInterests(e.target.value)}
                        className="w-full rounded-lg border bg-slate-50 dark:bg-slate-800 px-4 py-2 outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium resize-none h-24"
                        placeholder="Space, Dinosaurs, Coding..."
                    />
                </div>
                {error && <p className="text-sm font-medium text-red-500">{error}</p>}
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
                <Button variant="ghost" type="button" className="flex-1" onClick={onCancel}>Cancel</Button>
                <Button type="submit" className="flex-1 h-11 text-lg font-bold" disabled={loading}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Profile"}
                </Button>
            </div>
        </form>
    );
}
