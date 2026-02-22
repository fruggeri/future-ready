"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
    Rocket,
    Brain,
    Send,
    CheckCircle2,
    Trophy,
    RefreshCcw,
    Sparkles,
    Star,
    Flame,
    LogOut,
    ChartLine,
    Mic,
    Square,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";

type Challenge = {
    id: string;
    domain: string;
    level: number;
    prompt: string;
};

type ChildInfo = {
    id: string;
    name: string;
    age: number;
    level: number;
    xp: number;
    xpIntoLevel: number;
    xpForNextLevel: number;
    progressPercent: number;
    currentLevelsByDomain: Record<string, number>;
};

type DomainProgress = {
    domain: string;
    level: number;
    xpIntoLevel: number;
    xpForNextLevel: number;
    progressPercent: number;
};

type EvaluationFeedback = {
    strengths: string;
    improvement_area: string;
    coaching_feedback: string;
    next_step_suggestion: string;
    xpAwarded: number;
};

type RecentWork = {
    id: string;
    createdAt: string;
    responseText: string;
    challenge: {
        id: string;
        domain: string;
        level: number;
        prompt: string;
    };
    evaluation: {
        strengths: string;
        coachingFeedback: string;
        nextStepSuggestion: string;
        xpAwarded: number;
        internalScore: number;
    } | null;
};

type ActiveChallengeResponse = {
    child: ChildInfo;
    challenge: Challenge;
    domainProgress: DomainProgress;
    allDomainProgress: DomainProgress[];
    recentWork: RecentWork[];
};

type BrowserSpeechRecognition = {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onstart: (() => void) | null;
    onend: (() => void) | null;
    onerror: ((event: { error?: string }) => void) | null;
    onresult: ((event: {
        resultIndex: number;
        results: ArrayLike<{
            isFinal: boolean;
            0: { transcript: string };
        }>;
    }) => void) | null;
    start: () => void;
    stop: () => void;
};

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

function formatDateTime(value: string) {
    return new Date(value).toLocaleString();
}

function computeStreakDays(recentWork: RecentWork[]) {
    if (recentWork.length === 0) return 0;
    const uniqueDays = Array.from(new Set(recentWork.map((item) => new Date(item.createdAt).toISOString().slice(0, 10))));
    uniqueDays.sort((a, b) => (a > b ? -1 : 1));

    let streak = 0;
    const cursor = new Date();
    while (true) {
        const key = cursor.toISOString().slice(0, 10);
        if (!uniqueDays.includes(key)) break;
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
}

export default function KidPortal() {
    const router = useRouter();
    const [challenge, setChallenge] = useState<Challenge | null>(null);
    const [response, setResponse] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [feedback, setFeedback] = useState<EvaluationFeedback | null>(null);
    const [childInfo, setChildInfo] = useState<ChildInfo | null>(null);
    const [domainProgress, setDomainProgress] = useState<DomainProgress | null>(null);
    const [allDomainProgress, setAllDomainProgress] = useState<DomainProgress[]>([]);
    const [recentWork, setRecentWork] = useState<RecentWork[]>([]);
    const [selectedWork, setSelectedWork] = useState<RecentWork | null>(null);
    const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
    const [speechSupported, setSpeechSupported] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [interimTranscript, setInterimTranscript] = useState("");
    const [dictationError, setDictationError] = useState("");
    const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
    const responseRef = useRef("");
    const dictationBaseRef = useRef("");
    const [showPreview, setShowPreview] = useState(false);

    const completedCount = recentWork.length;
    const streakDays = useMemo(() => computeStreakDays(recentWork), [recentWork]);
    const badges = useMemo(() => {
        const earned: string[] = [];
        if (completedCount >= 1) earned.push("First Win");
        if (completedCount >= 5) earned.push("Momentum Builder");
        if (completedCount >= 10) earned.push("Skill Climber");
        if (streakDays >= 3) earned.push("3-Day Streak");
        if (streakDays >= 7) earned.push("Weekly Hero");
        return earned;
    }, [completedCount, streakDays]);

    const loadKidData = async (childId?: string | null) => {
        setIsLoading(true);
        try {
            const meRes = await fetch("/api/kid/auth/me");
            if (meRes.status === 401) {
                setShowPreview(true);
                return;
            }

            const challengeUrl = childId ? `/api/challenges/active?childId=${childId}` : "/api/challenges/active";
            const challengeRes = await fetch(challengeUrl);
            if (challengeRes.status === 401) {
                setShowPreview(true);
                return;
            }
            if (!challengeRes.ok) {
                throw new Error("Failed to fetch challenge");
            }

            const data = (await challengeRes.json()) as ActiveChallengeResponse;
            setChallenge(data.challenge);
            setChildInfo(data.child);
            setDomainProgress(data.domainProgress);
            setAllDomainProgress(data.allDomainProgress || []);
            setRecentWork(data.recentWork || []);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const childId = new URL(window.location.href).searchParams.get("childId");
        setSelectedChildId(childId);
        loadKidData(childId);
    }, []);

    useEffect(() => {
        responseRef.current = response;
    }, [response]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const browserWindow = window as Window & {
            SpeechRecognition?: BrowserSpeechRecognitionCtor;
            webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
        };
        const SpeechRecognitionCtor = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
        if (!SpeechRecognitionCtor) return;

        const recognition = new SpeechRecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
            setIsListening(true);
            setDictationError("");
            dictationBaseRef.current = responseRef.current;
        };

        recognition.onend = () => {
            setIsListening(false);
            setInterimTranscript("");
            dictationBaseRef.current = responseRef.current;
        };

        recognition.onerror = (event) => {
            setIsListening(false);
            if (event?.error === "not-allowed") {
                setDictationError("Microphone access is blocked. Please allow mic permissions and try again.");
                return;
            }
            setDictationError("Voice dictation had an issue. Please try again.");
        };

        recognition.onresult = (event) => {
            let finalTranscript = "";
            let interim = "";

            for (let i = 0; i < event.results.length; i += 1) {
                const transcript = event.results[i][0]?.transcript || "";
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interim += transcript;
                }
            }

            const spokenText = `${finalTranscript} ${interim}`.trim();
            const base = dictationBaseRef.current;
            const spacer = base.length > 0 && !base.endsWith(" ") && spokenText ? " " : "";
            setResponse(`${base}${spacer}${spokenText}`);
            setInterimTranscript(interim.trim());
        };

        recognitionRef.current = recognition;
        setSpeechSupported(true);

        return () => {
            recognition.stop();
            recognitionRef.current = null;
        };
    }, []);

    const handleSubmit = async () => {
        if (!response.trim() || !challenge) return;
        if (isListening) {
            recognitionRef.current?.stop();
        }
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/submissions/evaluate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    challengeId: challenge.id,
                    responseText: response,
                }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to evaluate: ${res.status}`);
            }

            const data = await res.json();
            setFeedback({
                strengths: data.evaluation.strengths,
                improvement_area: data.evaluation.improvementArea,
                coaching_feedback: data.evaluation.coachingFeedback,
                next_step_suggestion: data.evaluation.nextStepSuggestion,
                xpAwarded: data.xpAwarded,
            });
        } catch (error) {
            console.error(error);
            alert("Something went wrong. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleDictation = () => {
        const recognition = recognitionRef.current;
        if (!recognition) return;
        setDictationError("");

        if (isListening) {
            recognition.stop();
            return;
        }

        try {
            recognition.start();
        } catch {
            setDictationError("Could not start voice dictation. Please try again.");
        }
    };

    const handleKidLogout = async () => {
        recognitionRef.current?.stop();
        await fetch("/api/kid/auth/logout", { method: "POST" });
        router.push("/kid/login");
    };

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_10%_10%,#dbeafe_0%,#f8fafc_45%,#fef9c3_100%)]">
                <RefreshCcw className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (showPreview) {
        return (
            <div className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#dbeafe_0%,#f8fafc_45%,#fef9c3_100%)]">
                <main className="container mx-auto max-w-5xl px-4 py-10 space-y-6">
                    <Card className="overflow-hidden border-2 border-sky-100 bg-white/95 shadow-xl">
                        <CardContent className="grid gap-6 p-6 md:grid-cols-2 md:items-center">
                            <div className="space-y-4">
                                <Badge variant="secondary" className="w-fit rounded-full px-3 py-1">Kid Experience Preview</Badge>
                                <h1 className="text-3xl font-black tracking-tight text-slate-900">Kids get one clear mission at a time</h1>
                                <p className="text-slate-600">Age-appropriate challenges, voice dictation, XP rewards, and coaching feedback designed to help kids grow fast.</p>
                                <div className="flex flex-wrap gap-3">
                                    <Button asChild className="rounded-full px-6">
                                        <a href="/kid/login">Kid Login (Access Code)</a>
                                    </Button>
                                    <Button asChild variant="outline" className="rounded-full px-6">
                                        <a href="/signup">Parent Sign Up</a>
                                    </Button>
                                    <Button asChild variant="outline" className="rounded-full px-6">
                                        <a href="/login">Parent Login</a>
                                    </Button>
                                </div>
                            </div>
                            <div className="overflow-hidden rounded-2xl border bg-slate-50 shadow-md">
                                <Image
                                    src="/walkthrough/kid_challenge.png"
                                    alt="Kid mission hub preview"
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
                                <CardTitle className="text-lg">Mission Screen + Voice Dictation</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 pt-0">
                                <div className="overflow-hidden rounded-xl border">
                                    <Image
                                        src="/walkthrough/kid_challenge.png"
                                        alt="Kid challenge and dictation preview"
                                        width={1000}
                                        height={680}
                                        className="h-52 w-full object-cover"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="overflow-hidden border-2 border-amber-100 bg-white/95">
                            <CardHeader>
                                <CardTitle className="text-lg">Progress + Previous Work</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 pt-0">
                                <div className="overflow-hidden rounded-xl border">
                                    <Image
                                        src="/walkthrough/kid_feedback.png"
                                        alt="Kid previous work and progress preview"
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

    if (!challenge || !childInfo || !domainProgress) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center space-y-4 bg-slate-50 px-4">
                <h2 className="text-xl font-bold text-center">No active challenge found right now.</h2>
                <Button onClick={() => loadKidData(selectedChildId)}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_10%_10%,#dbeafe_0%,#f8fafc_45%,#fef9c3_100%)]">
            <header className="sticky top-0 z-10 border-b bg-white/85 backdrop-blur-md">
                <div className="container mx-auto flex min-h-18 items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
                            <Rocket className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Welcome back</p>
                            <p className="font-extrabold tracking-tight text-lg">{childInfo.name}&apos;s Mission Hub</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="px-3 py-1 text-sm">Lvl {childInfo.level}</Badge>
                        <Button variant="outline" size="sm" onClick={handleKidLogout}>
                            <LogOut className="mr-1 h-4 w-4" /> Exit
                        </Button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto flex-1 px-4 py-6 max-w-4xl space-y-6">
                <div className="grid gap-4 md:grid-cols-4">
                    <Card className="md:col-span-2 border-2 border-blue-100 shadow-md">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2"><ChartLine className="h-4 w-4" /> Level Progress</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold">{childInfo.xpIntoLevel}/{childInfo.xpForNextLevel} XP to next level</span>
                                <span className="text-muted-foreground">{childInfo.progressPercent}%</span>
                            </div>
                            <Progress value={childInfo.progressPercent} className="h-3" />
                            <p className="text-xs text-muted-foreground">Every level takes more XP than the one before it.</p>
                        </CardContent>
                    </Card>

                    <Card className="border-2 border-orange-100 shadow-md">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2"><Flame className="h-4 w-4 text-orange-500" /> Streak</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-extrabold">{streakDays}</p>
                            <p className="text-xs text-muted-foreground">consecutive days</p>
                        </CardContent>
                    </Card>

                    <Card className="border-2 border-amber-100 shadow-md">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Badges</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-extrabold">{badges.length}</p>
                            <p className="text-xs text-muted-foreground">earned</p>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-2 border-sky-100 shadow-md">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base">6 Focus Areas</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                        {allDomainProgress.map((item) => (
                            <div key={item.domain} className="rounded-xl border bg-white p-3">
                                <div className="mb-1 flex items-center justify-between text-xs">
                                    <span className="font-semibold">{item.domain}</span>
                                    <span className="text-muted-foreground">Level {item.level}</span>
                                </div>
                                <Progress value={item.progressPercent} className="h-2.5" />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {badges.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {badges.map((badge) => (
                            <Badge key={badge} className="px-3 py-1 bg-emerald-500 hover:bg-emerald-500 text-white border-none">{badge}</Badge>
                        ))}
                    </div>
                ) : null}

                <AnimatePresence mode="wait">
                    {!feedback ? (
                        <motion.div
                            key="challenge"
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            className="space-y-4"
                        >
                            <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="px-3 py-1">
                                    <Brain className="mr-2 h-3.5 w-3.5" /> {challenge.domain}
                                </Badge>
                                <span className="text-sm font-medium text-muted-foreground">Challenge Level {challenge.level}</span>
                            </div>

                            <Card className="border-2 border-primary/15 shadow-xl">
                                <CardHeader>
                                    <CardTitle className="text-xl leading-relaxed">{challenge.prompt}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <textarea
                                        className="w-full min-h-[220px] p-4 rounded-xl border-2 border-slate-200 bg-white focus:border-primary transition-all resize-none text-lg"
                                        placeholder="Write your best answer here..."
                                        value={response}
                                        onChange={(e) => setResponse(e.target.value)}
                                    />
                                    <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-xs font-semibold text-slate-600">
                                                Voice Dictation
                                            </p>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                disabled={!speechSupported}
                                                onClick={handleToggleDictation}
                                                className={isListening ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-50" : ""}
                                            >
                                                {isListening ? (
                                                    <>
                                                        <Square className="mr-2 h-4 w-4" /> Stop Voice
                                                    </>
                                                ) : (
                                                    <>
                                                        <Mic className="mr-2 h-4 w-4" /> Start Voice
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                        {!speechSupported ? (
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                Voice dictation is not supported on this browser/device.
                                            </p>
                                        ) : null}
                                        {interimTranscript ? (
                                            <p className="mt-2 text-xs italic text-slate-600">
                                                Listening: {interimTranscript}
                                            </p>
                                        ) : null}
                                        {dictationError ? (
                                            <p className="mt-2 text-xs font-medium text-red-600">
                                                {dictationError}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>Tip: explain your reasoning, not just the answer.</span>
                                        <span>{response.trim().length} chars</span>
                                    </div>
                                </CardContent>
                            </Card>

                            <Button
                                onClick={handleSubmit}
                                disabled={!response.trim() || isSubmitting}
                                className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg shadow-primary/20"
                            >
                                {isSubmitting ? (
                                    <RefreshCcw className="mr-2 h-5 w-5 animate-spin" />
                                ) : (
                                    <Send className="mr-2 h-5 w-5" />
                                )}
                                {isSubmitting ? "AI Coach is Reviewing..." : "Submit Mission"}
                            </Button>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="feedback"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            <div className="text-center space-y-2 py-2">
                                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
                                    <CheckCircle2 className="h-10 w-10" />
                                </div>
                                <h2 className="text-2xl font-bold">Mission Complete!</h2>
                                <div className="flex items-center justify-center gap-2 text-primary font-bold text-xl">
                                    <Sparkles className="h-5 w-5" /> +{feedback.xpAwarded} XP earned
                                </div>
                            </div>

                            <div className="grid gap-4">
                                <Card className="bg-blue-50 border-blue-100">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider text-blue-600 flex items-center gap-2"><Trophy className="h-4 w-4" /> Strengths</CardTitle></CardHeader>
                                    <CardContent><p className="text-lg leading-relaxed font-medium">{feedback.strengths}</p></CardContent>
                                </Card>
                                <Card className="bg-violet-50 border-violet-100">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider text-violet-600">AI Coaching</CardTitle></CardHeader>
                                    <CardContent><p className="text-lg leading-relaxed">{feedback.coaching_feedback}</p></CardContent>
                                </Card>
                                <Card className="bg-amber-50 border-amber-100">
                                    <CardHeader className="pb-2"><CardTitle className="text-sm uppercase tracking-wider text-amber-600">Next Step</CardTitle></CardHeader>
                                    <CardContent><p className="text-lg leading-relaxed font-medium">{feedback.next_step_suggestion}</p></CardContent>
                                </Card>
                            </div>

                            <Button className="w-full h-12 rounded-xl" onClick={async () => {
                                recognitionRef.current?.stop();
                                setFeedback(null);
                                setResponse("");
                                await loadKidData(selectedChildId);
                            }}>
                                Load Next Challenge
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <Card className="border-2 border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Domain Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="font-semibold">{domainProgress.domain} • Level {domainProgress.level}</span>
                            <span className="text-muted-foreground">{domainProgress.xpIntoLevel}/{domainProgress.xpForNextLevel} XP</span>
                        </div>
                        <Progress value={domainProgress.progressPercent} className="h-3" />
                        <p className="text-xs text-muted-foreground">{domainProgress.progressPercent}% to next {domainProgress.domain} level.</p>
                    </CardContent>
                </Card>

                <Card className="border-2 border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg">Your Previous Work</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {recentWork.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Complete your first mission to unlock your history.</p>
                        ) : (
                            recentWork.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className="w-full text-left rounded-xl border p-3 bg-white/70 space-y-2 hover:border-primary/40 hover:shadow-sm transition"
                                    onClick={() => setSelectedWork(item)}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <Badge variant="outline">{item.challenge.domain} • L{item.challenge.level}</Badge>
                                        <span className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</span>
                                    </div>
                                    <p className="text-sm text-muted-foreground line-clamp-2">
                                        <span className="font-semibold text-foreground">Your answer:</span> {item.responseText}
                                    </p>
                                    {item.evaluation ? (
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            <span className="font-semibold text-foreground">Coach:</span> {item.evaluation.coachingFeedback}
                                        </p>
                                    ) : null}
                                    <p className="text-xs font-semibold text-primary">Tap to view full details</p>
                                </button>
                            ))
                        )}
                    </CardContent>
                </Card>
            </main>

            <AnimatePresence>
                {selectedWork ? (
                    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 20, scale: 0.98 }}
                            className="w-full max-w-2xl rounded-2xl border bg-white shadow-2xl overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b flex items-center justify-between">
                                <h3 className="text-lg font-bold">Mission Details</h3>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedWork(null)}>Close</Button>
                            </div>
                            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                                <div className="flex items-center justify-between text-sm">
                                    <Badge variant="outline">{selectedWork.challenge.domain} • L{selectedWork.challenge.level}</Badge>
                                    <span className="text-muted-foreground">{formatDateTime(selectedWork.createdAt)}</span>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Question</p>
                                    <p className="text-base leading-relaxed">{selectedWork.challenge.prompt}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Your Answer</p>
                                    <p className="text-base leading-relaxed whitespace-pre-wrap">{selectedWork.responseText}</p>
                                </div>
                                {selectedWork.evaluation ? (
                                    <div className="space-y-3">
                                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">AI Feedback</p>
                                        <div className="rounded-xl border bg-blue-50 p-3">
                                            <p className="text-xs font-semibold text-blue-700 mb-1">Strengths</p>
                                            <p className="text-sm leading-relaxed">{selectedWork.evaluation.strengths}</p>
                                        </div>
                                        <div className="rounded-xl border bg-violet-50 p-3">
                                            <p className="text-xs font-semibold text-violet-700 mb-1">Coaching</p>
                                            <p className="text-sm leading-relaxed">{selectedWork.evaluation.coachingFeedback}</p>
                                        </div>
                                        <div className="rounded-xl border bg-amber-50 p-3">
                                            <p className="text-xs font-semibold text-amber-700 mb-1">Next Step</p>
                                            <p className="text-sm leading-relaxed">{selectedWork.evaluation.nextStepSuggestion}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No AI feedback available for this submission yet.</p>
                                )}
                            </div>
                        </motion.div>
                    </div>
                ) : null}
            </AnimatePresence>
        </div>
    );
}
