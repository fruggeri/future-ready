"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Brain, BarChart3, Sparkles, Compass, Rocket, Stars, ShieldCheck, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { FOCUS_DOMAINS } from "@/lib/focus-domains";

const features = [
  {
    title: "100+ Age-Appropriate Challenges",
    description: "Kids rotate through a structured challenge bank so every session feels fresh and meaningful.",
    icon: Brain,
    color: "from-sky-500 to-cyan-400",
  },
  {
    title: "AI Coaching Feedback",
    description: "Each answer gets strengths, coaching notes, and next-step suggestions kids can apply right away.",
    icon: Sparkles,
    color: "from-amber-500 to-orange-400",
  },
  {
    title: "Parent Progress Visibility",
    description: "Parents can review the exact question, the child response, and the AI feedback for every submission.",
    icon: BarChart3,
    color: "from-emerald-500 to-teal-400",
  },
];

const milestones = [
  {
    label: "Launch",
    value: "Quick child login",
    detail: "Parent creates a child profile and shares a short access code.",
    icon: ShieldCheck,
  },
  {
    label: "Grow",
    value: "Challenge + feedback loop",
    detail: "Kid submits work, earns XP, and sees clear guidance to improve.",
    icon: Compass,
  },
  {
    label: "Level Up",
    value: "Harder goals over time",
    detail: "Progression pacing increases so each new level feels earned.",
    icon: Stars,
  },
];

const walkthroughShots = [
  {
    src: "/walkthrough/kid_challenge.png",
    alt: "Kid mission hub screen",
    label: "Kid Mission Hub",
    tone: "from-sky-500/70 to-cyan-500/70",
  },
  {
    src: "/walkthrough/parent_overview.png",
    alt: "Parent dashboard screen",
    label: "Parent Overview",
    tone: "from-emerald-500/70 to-teal-500/70",
  },
  {
    src: "/walkthrough/kid_feedback.png",
    alt: "Kid progress and previous work screen",
    label: "Growth + Feedback",
    tone: "from-amber-500/70 to-orange-500/70",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,#dbeafe_0%,#f8fafc_45%,#fefce8_100%)] pb-20">
      <main className="container mx-auto px-4 pt-10 md:pt-14">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="space-y-6"
          >
            <Badge variant="secondary" className="rounded-full px-4 py-1 text-sm font-bold">
              Family-Friendly AI Learning
            </Badge>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Build confident AI thinkers at home, one challenge at a time.
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
              FutureReady helps kids practice critical thinking with guided challenges while giving parents clear visibility into growth, feedback, and progress.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="rounded-full px-8 text-base font-bold" asChild>
                <a href="/kid/login">Kid Login</a>
              </Button>
              <Button variant="outline" size="lg" className="rounded-full px-8 text-base font-bold" asChild>
                <a href="/parent">Open Parent Area</a>
              </Button>
              <Button variant="ghost" size="lg" className="rounded-full px-8 text-base font-bold" asChild>
                <a href="/demo">See Demo</a>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="relative"
          >
            <div className="absolute -top-6 -left-6 h-28 w-28 rounded-full bg-sky-300/35 blur-2xl" />
            <div className="absolute -bottom-6 -right-6 h-28 w-28 rounded-full bg-amber-300/40 blur-2xl" />

            <Card className="overflow-hidden border-2 border-sky-100 bg-white/95 shadow-xl">
              <CardHeader className="border-b bg-gradient-to-r from-sky-50 to-amber-50 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Rocket className="h-5 w-5 text-primary" /> Product Walkthrough
                </CardTitle>
                <CardDescription>Preview both parent and kid screens before diving in.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  {walkthroughShots.map((shot, i) => (
                    <motion.div
                      key={shot.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35, delay: i * 0.06 }}
                      className={`${i === 2 ? "sm:col-span-2" : ""}`}
                    >
                      <div className={`rounded-2xl bg-gradient-to-br p-[2px] ${shot.tone}`}>
                        <div className="overflow-hidden rounded-[14px] border border-white/80 bg-white shadow-md">
                          <div className="relative">
                            <Image
                              src={shot.src}
                              alt={shot.alt}
                              width={900}
                              height={600}
                              className={`w-full object-cover ${i === 2 ? "h-44 md:h-48" : "h-40"}`}
                            />
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900/50 to-transparent" />
                            <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-800">
                              {shot.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <Button className="w-full rounded-full font-bold" asChild>
                  <a href="/demo">Open Full Demo</a>
                </Button>
                <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500">
                  <PlayCircle className="h-3.5 w-3.5" /> Screens captured from the live product experience
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="border-2 border-white/80 bg-white/90 shadow-md">
              <CardHeader className="space-y-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.color} text-white shadow-md`}>
                  <feature.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        <section className="mt-10 rounded-3xl border-2 border-sky-100 bg-white/90 p-5 shadow-lg md:p-8">
          <div className="mb-6 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">How the learning loop works</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {milestones.map((item) => (
              <div key={item.label} className="rounded-2xl border bg-gradient-to-b from-white to-sky-50/60 p-4">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
                  <item.icon className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">{item.label}</p>
                <p className="mt-1 text-base font-bold text-slate-900">{item.value}</p>
                <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-3xl border-2 border-emerald-100 bg-white/95 p-5 shadow-lg md:p-8">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">Curriculum</p>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">6 Areas of Focus and Growth</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FOCUS_DOMAINS.map((domain) => (
              <div key={domain.name} className="rounded-2xl border bg-gradient-to-b from-white to-emerald-50/35 p-4">
                <p className="text-sm font-black text-slate-900">{domain.name}</p>
                <p className="mt-1 text-xs font-semibold text-emerald-700">{domain.tagline}</p>
                <p className="mt-2 text-sm text-slate-600">{domain.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
