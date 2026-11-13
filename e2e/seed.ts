// Seeds ONE visible incident into a throwaway e2e database. Refuses to run against anything else.
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL ?? "";
if (!url.includes("e2e")) {
  console.error("Recusado: DATABASE_URL tem de conter «e2e» (nunca semear a base de dados real).");
  process.exit(1);
}

async function main() {
  const db = new PrismaClient({ datasourceUrl: url });
  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await db.incident.create({
    data: {
      key: "https://example.test/ocorrencia",
      category: "ROUBO",
      summary: "Ocorrência de teste para o teste de fumo.",
      sourceName: "Fonte de teste",
      sourceTier: "IMPRENSA",
      independenceKey: "fonte-de-teste",
      sourceLinkPublic: true,
      incidentStart: start,
      verificationStatus: "REPORTADO",
      firstReportedAt: start,
      lastCheckedAt: now,
      heldForReview: false,
      archivedAt: null,
      freguesiaSlug: "maceira",
      placeName: "Assenta",
      precision: "LOCALIDADE",
      latitude: 39.1,
      longitude: -9.3,
      contentHash: "e2e-hash",
      sourceId: "e2e",
      sourceUrl: "https://example.test/ocorrencia",
      publicationDate: start,
      retrievalDate: now,
      geographicArea: "Maceira",
    },
  });
  console.log("1 incident");
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
