"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles, UserRound, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type DemoMode = "kid" | "parent";

type DemoSlide = {
  title: string;
  subtitle: string;
  image: string;
  bullets: string[];
};

const kidSlides: DemoSlide[] = [
  {
    title: "Kid Mission Hub",
    subtitle: "Current challenge screen with level, streak, badges, and voice-ready answer box.",
    image: "/walkthrough/kid_challenge.png",
    bullets: [
      "One active challenge with domain + level context",
      "Large response area with dictation controls",
      "Top progress cards for XP, streak, and badges",
    ],
  },
  {
    title: "Kid Progress + Previous Work",
    subtitle: "Kids can review domain growth and open previous submissions with AI feedback.",
    image: "/walkthrough/kid_feedback.png",
    bullets: [
      "6 focus-area progress section",
      "Previous work list with question + answer + coaching details",
      "Clear path to continue and level up",
    ],
  },
];

const parentSlides: DemoSlide[] = [
  {
    title: "Parent Overview",
    subtitle: "Live parent dashboard with child cards, stats, and recent activity.",
    image: "/walkthrough/parent_overview.png",
    bullets: [
      "Per-child metrics: completed work, XP, average score",
      "All 6 domain level indicators",
      "Recent activity list with submission detail modal",
    ],
  },
  {
    title: "Conversation Bridge",
    subtitle: "Conversation starter panel inside the current parent experience.",
    image: "/walkthrough/parent_starters.png",
    bullets: [
      "Quick prompts for parent-child reflection",
      "Designed for everyday follow-up conversations",
      "Sits next to analytics in the parent sidebar",
    ],
  },
];

const flowByMode: Record<DemoMode, string[]> = {
  kid: [
    "Enter kid access code",
    "Complete one challenge mission",
    "Get coaching + XP",
    "Track level and domain progress",
  ],
  parent: [
    "Review latest child submissions",
    "See coaching summaries and trends",
    "Use suggested conversation starters",
    "Guide next challenge rhythm",
  ],
};

export default function DemoPage() {
  const [mode, setMode] = React.useState<DemoMode>("kid");
  const [index, setIndex] = React.useState(0);

  const slides = mode === "kid" ? kidSlides : parentSlides;
  const current = slides[index];
  const isKid = mode === "kid";

  React.useEffect(() => {
    setIndex(0);
  }, [mode]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_10%_10%,#dbeafe_0%,#f8fafc_45%,#fef9c3_100%)]">
      <header className="sticky top-0 z-20 border-b bg-white/85 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Demo Experience</p>
            <h1 className="text-xl font-extrabold tracking-tight">FutureReady Product Walkthrough</h1>
          </div>
          <Badge variant="secondary" className="px-3 py-1">Interactive Preview</Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex justify-center">
          <div className="inline-flex rounded-full border bg-white p-1 shadow-sm">
            <button
              onClick={() => setMode("kid")}
              className={`px-6 py-2 rounded-full text-sm font-bold transition ${isKid ? "bg-primary text-white" : "text-slate-600 hover:text-slate-900"}`}
            >
              <span className="inline-flex items-center gap-2"><UserRound className="h-4 w-4" /> Kid Journey</span>
            </button>
            <button
              onClick={() => setMode("parent")}
              className={`px-6 py-2 rounded-full text-sm font-bold transition ${!isKid ? "bg-primary text-white" : "text-slate-600 hover:text-slate-900"}`}
            >
              <span className="inline-flex items-center gap-2"><UsersRound className="h-4 w-4" /> Parent Journey</span>
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-2 border-slate-200 shadow-lg overflow-hidden">
            <CardHeader className="flex flex-row items-start justify-between gap-4 bg-white">
              <div>
                <CardTitle className="text-2xl">{current.title}</CardTitle>
                <CardDescription className="text-base mt-1">{current.subtitle}</CardDescription>
              </div>
              <Badge variant="outline">Screen {index + 1}/{slides.length}</Badge>
            </CardHeader>

            <CardContent className="space-y-4 bg-slate-50/70">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${mode}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="relative aspect-[16/10] overflow-hidden rounded-xl border bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={current.image} alt={current.title} className="h-full w-full object-cover" />
                </motion.div>
              </AnimatePresence>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1))}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIndex((prev) => (prev + 1) % slides.length)}
                >
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-2 border-slate-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg inline-flex items-center gap-2"><Sparkles className="h-4 w-4" /> What This Screen Shows</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {current.bullets.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
                    <span>{item}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-2 border-slate-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-lg">Walkthrough Flow</CardTitle>
                <CardDescription>{isKid ? "Kid" : "Parent"} experience in order</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {flowByMode[mode].map((step, i) => (
                  <div key={step} className="rounded-lg border bg-white px-3 py-2 text-sm">
                    <span className="font-bold mr-2 text-primary">{i + 1}.</span>{step}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Button className="w-full h-12 text-base" asChild>
              <a href={isKid ? "/kid/login" : "/parent"}>
                Open {isKid ? "Kid" : "Parent"} Experience <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
