import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const issues = await db.issue.deleteMany({ where: { isExample: true } });
  const claims = await db.claim.deleteMany({ where: { isExample: true } });
  const budget = await db.budgetEntry.deleteMany({ where: { isExample: true } });
  const proposals = await db.topicProposal.deleteMany({ where: { title: { startsWith: "[EXEMPLO]" } } });
  console.log(`Removidos: ${issues.count} temas, ${claims.count} afirmações, ${budget.count} valores, ${proposals.count} propostas.`);
}

main().finally(() => db.$disconnect());
