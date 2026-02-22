import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { generateKidAccessCode } from "../src/lib/access-code";
import {
  buildChallengeTemplateSeeds,
  CHALLENGE_BLUEPRINT_COUNT,
  CHALLENGE_TEMPLATE_COUNT,
} from "../src/lib/challenge-library";
import { createInitialDomainLevels } from "../src/lib/focus-domains";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const templateSeeds = buildChallengeTemplateSeeds();

async function main() {
  console.log("Seeding challenge template library...");

  await prisma.challengeTemplate.deleteMany({});
  await prisma.challengeTemplate.createMany({ data: templateSeeds });

  const demoEmail = process.env.DEMO_PARENT_EMAIL || "parent@example.com";
  const demoPassword = process.env.DEMO_PARENT_PASSWORD || "Password123!";
  const passwordHash = await bcrypt.hash(demoPassword, 10);

  const user = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      passwordHash,
      subscriptionStatus: "active",
      plan: "BETA",
      name: "Demo Parent",
    },
    create: {
      email: demoEmail,
      name: "Demo Parent",
      passwordHash,
      subscriptionStatus: "active",
      plan: "BETA",
    },
  });

  const existingChild = await prisma.child.findFirst({
    where: { userId: user.id, name: "Alex" },
  });

  if (!existingChild) {
    let kidAccessCode = "";
    do {
      kidAccessCode = generateKidAccessCode();
    } while (await prisma.child.findFirst({ where: { kidAccessCode }, select: { id: true } }));

    await prisma.child.create({
      data: {
        userId: user.id,
        name: "Alex",
        age: 12,
        kidAccessCode,
        interests: "Science, design, storytelling",
        currentLevelsByDomain: {
          ...createInitialDomainLevels(1),
          "Critical Thinking": 3,
          "Problem Framing": 2,
          "Communication Clarity": 4,
          "Creative Synthesis": 2,
          "AI Collaboration": 2,
          "Independent Learning": 3,
        },
      },
    });
  } else if (!existingChild.kidAccessCode) {
    let kidAccessCode = "";
    do {
      kidAccessCode = generateKidAccessCode();
    } while (await prisma.child.findFirst({ where: { kidAccessCode }, select: { id: true } }));

    await prisma.child.update({
      where: { id: existingChild.id },
      data: { kidAccessCode },
    });
  }

  const childrenWithoutCodes = await prisma.child.findMany({
    where: { kidAccessCode: null },
    select: { id: true },
  });

  for (const child of childrenWithoutCodes) {
    let kidAccessCode = "";
    do {
      kidAccessCode = generateKidAccessCode();
    } while (await prisma.child.findFirst({ where: { kidAccessCode }, select: { id: true } }));

    await prisma.child.update({
      where: { id: child.id },
      data: { kidAccessCode },
    });
  }

  console.log(
    `Inserted ${templateSeeds.length} challenge templates (${CHALLENGE_BLUEPRINT_COUNT} prompts x 3 age bands).`
  );
  console.log(`Challenge library target met: ${CHALLENGE_TEMPLATE_COUNT} templates.`);
  console.log("Seeding complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
