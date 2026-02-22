import { FOCUS_DOMAINS } from "./focus-domains";

export type ChallengeTemplateSeed = {
  ageMin: number;
  ageMax: number;
  domain: string;
  level: number;
  prompt: string;
  sortOrder: number;
};

type AgeBand = {
  ageMin: number;
  ageMax: number;
  complexityBoost: number;
  framing: string;
};

type ChallengeBlueprint = {
  domain: string;
  baseLevel: number;
  promptCore: string;
};

const ageBands: AgeBand[] = [
  {
    ageMin: 8,
    ageMax: 10,
    complexityBoost: 0,
    framing: "Write 3-5 sentences with one clear reason.",
  },
  {
    ageMin: 11,
    ageMax: 13,
    complexityBoost: 1,
    framing: "Write 5-8 sentences and include one tradeoff.",
  },
  {
    ageMin: 14,
    ageMax: 16,
    complexityBoost: 2,
    framing: "Write a structured response with a claim, evidence, and limitations.",
  },
];

const blueprints: ChallengeBlueprint[] = [
  { domain: "Critical Thinking", baseLevel: 2, promptCore: "Your school can add one club: robotics, drama, or gardening. Choose one and explain why it should come first." },
  { domain: "Critical Thinking", baseLevel: 2, promptCore: "A class wants to ban phones during lessons. Give one reason for and one reason against, then decide." },
  { domain: "Critical Thinking", baseLevel: 3, promptCore: "Two after-school programs both help students, but only one can be funded. Build a fair way to choose." },
  { domain: "Critical Thinking", baseLevel: 3, promptCore: "A video claims a new study method is best for everyone. What evidence would you check before believing it?" },
  { domain: "Critical Thinking", baseLevel: 4, promptCore: "A city park is often crowded and messy. Compare two possible fixes and defend the better first step." },
  { domain: "Critical Thinking", baseLevel: 4, promptCore: "Pick a common online claim and separate facts, opinions, and assumptions in your analysis." },

  { domain: "Problem Framing", baseLevel: 2, promptCore: "Your team keeps turning homework in late. List possible causes before suggesting a solution." },
  { domain: "Problem Framing", baseLevel: 2, promptCore: "The lunch line is too long. Ask five clarifying questions that would help define the real problem." },
  { domain: "Problem Framing", baseLevel: 3, promptCore: "Students forget instructions for projects. Break the issue into people, process, and tools." },
  { domain: "Problem Framing", baseLevel: 3, promptCore: "A reading app has low daily use. Define the problem in one sentence and list what data you need next." },
  { domain: "Problem Framing", baseLevel: 4, promptCore: "A science fair has fewer participants this year. Propose two different problem statements and how each changes the solution." },
  { domain: "Problem Framing", baseLevel: 4, promptCore: "Your class discussion feels shallow. Identify the hidden constraints causing this and one way to test your hypothesis." },

  { domain: "Communication Clarity", baseLevel: 2, promptCore: "Explain photosynthesis to a younger student without scientific jargon." },
  { domain: "Communication Clarity", baseLevel: 2, promptCore: "Write simple instructions for teaching a friend a game they have never played." },
  { domain: "Communication Clarity", baseLevel: 3, promptCore: "Summarize a news topic for a busy parent in six clear bullet points." },
  { domain: "Communication Clarity", baseLevel: 3, promptCore: "Explain how the internet works using one analogy and one limit of that analogy." },
  { domain: "Communication Clarity", baseLevel: 4, promptCore: "Write two versions of the same explanation: one for a child and one for a teacher." },
  { domain: "Communication Clarity", baseLevel: 4, promptCore: "Take a confusing paragraph and rewrite it so anyone can understand it in under one minute." },

  { domain: "Creative Synthesis", baseLevel: 2, promptCore: "Design a classroom routine that mixes movement, storytelling, and math practice." },
  { domain: "Creative Synthesis", baseLevel: 2, promptCore: "Invent a family game that teaches budgeting and teamwork at the same time." },
  { domain: "Creative Synthesis", baseLevel: 3, promptCore: "Combine a library and a makerspace into one program for your neighborhood." },
  { domain: "Creative Synthesis", baseLevel: 3, promptCore: "Create a low-cost idea that helps students calm down before tests." },
  { domain: "Creative Synthesis", baseLevel: 4, promptCore: "Blend art, science, and community service into one school project that could run for a month." },
  { domain: "Creative Synthesis", baseLevel: 4, promptCore: "Design a product that helps kids learn a language while playing outside." },

  { domain: "AI Collaboration", baseLevel: 2, promptCore: "Write a better AI prompt to get three fun science project ideas for your age." },
  { domain: "AI Collaboration", baseLevel: 2, promptCore: "An AI answer looks helpful but short. Ask three follow-up prompts to improve it." },
  { domain: "AI Collaboration", baseLevel: 3, promptCore: "Create a prompt checklist that makes AI responses more accurate and age-appropriate." },
  { domain: "AI Collaboration", baseLevel: 3, promptCore: "AI gave two different answers to the same question. Plan how you would verify which one is stronger." },
  { domain: "AI Collaboration", baseLevel: 4, promptCore: "Rewrite a vague prompt into a high-quality prompt with constraints, audience, and output format." },
  { domain: "AI Collaboration", baseLevel: 4, promptCore: "Design a mini workflow where AI helps brainstorm, but a human checks facts and final quality." },

  { domain: "Independent Learning", baseLevel: 2, promptCore: "Pick a topic you care about and make a 5-day learning plan with small daily goals." },
  { domain: "Independent Learning", baseLevel: 2, promptCore: "You forgot most of a chapter before a quiz. Build a simple recovery plan for the next three days." },
  { domain: "Independent Learning", baseLevel: 3, promptCore: "Create a weekly learning sprint with checkpoints and one reflection question for each day." },
  { domain: "Independent Learning", baseLevel: 3, promptCore: "Two study methods worked differently for you. Compare them and decide when to use each." },
  { domain: "Independent Learning", baseLevel: 4, promptCore: "You failed a practice test. Build a plan to diagnose gaps, practice deliberately, and retest." },
  { domain: "Independent Learning", baseLevel: 4, promptCore: "Design a self-coaching routine you can use whenever motivation drops during a hard project." },
];

// Keep blueprints aligned with declared focus domains.
const focusDomainNames = new Set(FOCUS_DOMAINS.map((domain) => domain.name));
for (const blueprint of blueprints) {
  if (!focusDomainNames.has(blueprint.domain)) {
    throw new Error(`Unknown focus domain in challenge blueprint: ${blueprint.domain}`);
  }
}

export function buildChallengeTemplateSeeds(): ChallengeTemplateSeed[] {
  const seeds: ChallengeTemplateSeed[] = [];

  ageBands.forEach((ageBand) => {
    blueprints.forEach((blueprint, index) => {
      seeds.push({
        ageMin: ageBand.ageMin,
        ageMax: ageBand.ageMax,
        domain: blueprint.domain,
        level: Math.max(1, Math.min(10, blueprint.baseLevel + ageBand.complexityBoost)),
        prompt: `${blueprint.promptCore} ${ageBand.framing}`,
        sortOrder: index + 1,
      });
    });
  });

  return seeds;
}

export const CHALLENGE_BLUEPRINT_COUNT = blueprints.length;
export const CHALLENGE_TEMPLATE_COUNT = blueprints.length * ageBands.length;
