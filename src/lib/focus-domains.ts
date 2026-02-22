export type FocusDomain = {
  name: string;
  tagline: string;
  description: string;
};

export const FOCUS_DOMAINS: FocusDomain[] = [
  {
    name: "Critical Thinking",
    tagline: "Evaluate and reason",
    description: "Compare ideas, assess evidence, and make defensible decisions.",
  },
  {
    name: "Problem Framing",
    tagline: "Define the real problem",
    description: "Ask better questions and identify root causes before jumping to solutions.",
  },
  {
    name: "Communication Clarity",
    tagline: "Explain with precision",
    description: "Turn complex ideas into clear language for different audiences.",
  },
  {
    name: "Creative Synthesis",
    tagline: "Combine ideas into new solutions",
    description: "Blend concepts across topics to design original, practical approaches.",
  },
  {
    name: "AI Collaboration",
    tagline: "Work effectively with AI",
    description: "Use prompts, verification, and iteration to get better results with AI tools.",
  },
  {
    name: "Independent Learning",
    tagline: "Plan and self-correct",
    description: "Set goals, monitor progress, and adapt strategy when learning gets hard.",
  },
];

export function createInitialDomainLevels(level = 1) {
  return Object.fromEntries(FOCUS_DOMAINS.map((domain) => [domain.name, level]));
}
