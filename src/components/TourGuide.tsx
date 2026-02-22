"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

interface TourStep {
    target: string; // ID of the element to highlight
    title: string;
    content: string;
    position: "top" | "bottom" | "left" | "right" | "center";
}

const tourSteps: TourStep[] = [
    {
        target: "tour-welcome",
        title: "Welcome to FutureReady",
        content: "This is your personalized command center. Here you can track your family's journey into the AI era. Let's take a quick look around.",
        position: "center",
    },
    {
        target: "tour-family-overview",
        title: "Family Overview",
        content: "See all your children's progress at a glance. We track XP, Levels, and specific skill growth over time.",
        position: "bottom",
    },
    {
        target: "tour-skill-domains",
        title: "Critical Skill Domains",
        content: "We focus on 6 growth domains: Critical Thinking, Problem Framing, Communication Clarity, Creative Synthesis, AI Collaboration, and Independent Learning.",
        position: "top",
    },
    {
        target: "tour-conversation-starter",
        title: "Bridge the Gap",
        content: "Don't let screen time be isolated time. We generate specific conversation starters based on what your child just learned, so you can discuss it at dinner.",
        position: "left",
    },
    {
        target: "tour-recent-activity",
        title: "Real-time Feedback",
        content: "See exactly when your child completes a challenge and the specific feedback they received from our AI coach.",
        position: "top",
    },
    {
        target: "tour-cta",
        title: "Ready to Start?",
        content: "Join thousands of forward-thinking families. Create your account today to start your own personalized dashboard.",
        position: "center",
    },
];

export function TourGuide() {
    const [currentStep, setCurrentStep] = useState(0);
    const [isVisible, setIsVisible] = useState(true);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    // Update target position when step changes
    useEffect(() => {
        if (!isVisible) return;

        const updatePosition = () => {
            const step = tourSteps[currentStep];
            if (step.position === "center") {
                setTargetRect(null);
                return;
            }

            const element = document.getElementById(step.target);
            if (element) {
                const rect = element.getBoundingClientRect();
                setTargetRect(rect);

                // Scroll element into view if needed
                element.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        };

        // Small delay to ensure DOM is ready
        const timer = setTimeout(updatePosition, 100);
        window.addEventListener("resize", updatePosition);

        return () => {
            clearTimeout(timer);
            window.removeEventListener("resize", updatePosition);
        };
    }, [currentStep, isVisible]);

    const handleNext = () => {
        if (currentStep < tourSteps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // End of tour
            window.location.href = "/parent"; // Redirect to sign up/login in real app
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSkip = () => {
        setIsVisible(false);
    };

    if (!isVisible) return null;

    const step = tourSteps[currentStep];

    return (
        <AnimatePresence>
            {/* Backdrop / Spotlight */}
            <motion.div
                key="tour-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
                // Clip path to create spotlight effect if we have a target
                style={
                    targetRect
                        ? {
                            clipPath: `polygon(
                                0% 0%, 
                                0% 100%, 
                                ${targetRect.left}px 100%, 
                                ${targetRect.left}px ${targetRect.top}px, 
                                ${targetRect.right}px ${targetRect.top}px, 
                                ${targetRect.right}px ${targetRect.bottom}px, 
                                ${targetRect.left}px ${targetRect.bottom}px, 
                                ${targetRect.left}px 100%, 
                                100% 100%, 
                                100% 0%
                            )`,
                        }
                        : {}
                }
            />

            {/* Tooltip Card */}
            <motion.div
                key="tour-tooltip-wrapper"
                className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
            >
                <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        // Dynamically position based on target if not center
                        ...(targetRect && step.position !== "center" ? {
                            position: "absolute",
                            top: step.position === "bottom" ? targetRect.bottom + 20 :
                                step.position === "top" ? targetRect.top - 200 : undefined,
                            left: step.position === "right" ? targetRect.right + 20 :
                                step.position === "left" ? targetRect.left - 340 : undefined,
                            x: 0,
                            y: 0
                        } : {})
                    }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className={`pointer-events-auto w-[320px] rounded-xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/5 dark:bg-slate-900 dark:ring-slate-100/10 ${targetRect && step.position !== "center" ? "absolute" : ""
                        }`}
                >
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                {step.title}
                            </h3>
                            <div className="flex gap-1 text-xs text-muted-foreground">
                                Step {currentStep + 1} of {tourSteps.length}
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-400 hover:text-slate-500"
                            onClick={handleSkip}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {step.content}
                    </p>

                    <div className="mt-6 flex items-center justify-between">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handlePrev}
                            disabled={currentStep === 0}
                            className="text-slate-500"
                        >
                            <ChevronLeft className="mr-1 h-3 w-3" /> Back
                        </Button>
                        <Button onClick={handleNext} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                            {currentStep === tourSteps.length - 1 ? (
                                "Sign Up Free"
                            ) : (
                                <>
                                    Next <ChevronRight className="ml-1 h-3 w-3" />
                                </>
                            )}
                        </Button>
                    </div>
                </motion.div>
            </motion.div>

            {/* Highlight Border (Optional, for extra emphasis) */}
            {targetRect && (
                <motion.div
                    key="tour-highlight"
                    layoutId="highlight"
                    className="fixed z-50 rounded-lg border-2 border-primary shadow-[0_0_30px_rgba(37,99,235,0.3)] pointer-events-none"
                    style={{
                        top: targetRect.top - 4,
                        left: targetRect.left - 4,
                        width: targetRect.width + 8,
                        height: targetRect.height + 8,
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}
        </AnimatePresence>
    );
}
