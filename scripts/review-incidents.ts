// Uso: npm run review:incidents
//
// Mostra as ocorrências que esperam revisão. As decisões registam-se em
// prisma/data/revisoes-ocorrencias.json, com { "key", "decision": "publicar" | "manter" | "arquivar", "note" }.

import { PrismaClient } from "@prisma/client";
import { SOURCE_TIER_NUMBER, VERIFICATION_LABEL } from "../src/lib/incidents";

async function main() {
  const db = new PrismaClient();
  try {
    const pending = await db.incident.findMany({
      where: { reviewStatus: "PENDENTE", archivedAt: null },
      include: { references: true },
      orderBy: { firstReportedAt: "asc" },
    });
    if (pending.length === 0) {
      console.log("Sem ocorrências por rever.");
      return;
    }
    console.table(
      pending.map((item) => ({
        estado: VERIFICATION_LABEL[item.verificationStatus],
        nivel: SOURCE_TIER_NUMBER[item.sourceTier],
        retida: item.heldForReview ? "sim" : "não",
        tipo: item.category,
        area: item.placeName,
        fontes: 1 + item.references.length,
        motivos: item.reviewReasons,
        key: item.key,
      })),
    );
    const log = await db.incidentLog.findMany({ where: { action: { in: ["REJEITADO", "ARQUIVADO"] } }, orderBy: { retrievalDate: "desc" }, take: 10 });
    if (log.length > 0) {
      console.log("Últimos recusados e arquivados:");
      console.table(log.map((item) => ({ acao: item.action, motivo: item.reason, fonte: item.sourceUrl })));
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
