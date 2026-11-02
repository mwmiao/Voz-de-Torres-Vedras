// Uso:
//   npm run diagnose:incidents                 resumo por origem
//   npm run diagnose:incidents -- --url <parte do URL>   percurso de um artigo
//
// Diz, para cada origem de ocorrências, o que foi lido, recusado, gravado e mostrado no mapa,
// e porque é que um artigo concreto aparece ou não.

import { PrismaClient } from "@prisma/client";
import { visibilityProblem, windowStartDay } from "../src/lib/incidents";
import { SOURCE_CATALOG, sourceStatus, SOURCE_STATUS_LABEL } from "../src/lib/source-catalog";

const db = new PrismaClient();
const now = new Date();

async function summary() {
  const sources = SOURCE_CATALOG.filter((source) => source.group === "ocorrencias");
  const since = new Date(`${windowStartDay(now)}T00:00:00Z`);
  const rows = [];
  for (const source of sources) {
    const [state, lastLog, rejected, stored, references] = await Promise.all([
      db.dataSourceState.findUnique({ where: { id: source.id } }),
      db.dataUpdateLog.findFirst({ where: { sourceId: source.id }, orderBy: { retrievalDate: "desc" } }),
      db.incidentLog.findMany({ where: { sourceId: source.id, action: "REJEITADO", retrievalDate: { gte: since } } }),
      db.incident.findMany({ where: { sourceId: source.id } }),
      db.incidentReference.count({ where: { sourceId: source.id } }),
    ]);
    rows.push({
      origem: source.id,
      estado: SOURCE_STATUS_LABEL[sourceStatus(source)],
      ultima_recolha: state?.lastRunAt?.toISOString().slice(0, 16) ?? "nunca",
      resultado: state?.lastStatus ?? "-",
      artigos: lastLog?.itemsFound ?? "-",
      ao_parser: lastLog?.itemsConsidered ?? "-",
      recusados: rejected.length,
      gravados: stored.length,
      fontes_extra: references,
      no_mapa: stored.filter((item) => !visibilityProblem(item, now)).length,
    });
    if (state?.lastError) console.log(`${source.id}: último erro: ${state.lastError}`);
  }
  console.table(rows);
  const reasons = await db.incidentLog.groupBy({ by: ["sourceId", "reason"], where: { action: "REJEITADO", retrievalDate: { gte: since } }, _count: { _all: true } });
  if (reasons.length > 0) {
    console.log("Motivos de recusa nos últimos 14 dias:");
    console.table(reasons.map((item) => ({ origem: item.sourceId, motivo: item.reason, total: item._count._all })));
  }
  const hidden = (await db.incident.findMany({ where: { incidentStart: { gte: since } } })).flatMap((item) => {
    const problem = visibilityProblem(item, now);
    return problem ? [{ origem: item.sourceId, url: item.key, motivo: problem }] : [];
  });
  if (hidden.length > 0) {
    console.log("Gravadas mas fora do mapa:");
    console.table(hidden);
  }
}

async function trace(fragment: string) {
  const [logs, incidents, references] = await Promise.all([
    db.incidentLog.findMany({ where: { OR: [{ sourceUrl: { contains: fragment } }, { duplicateOfKey: { contains: fragment } }] }, orderBy: { retrievalDate: "asc" } }),
    db.incident.findMany({ where: { key: { contains: fragment } }, include: { references: true } }),
    db.incidentReference.findMany({ where: { url: { contains: fragment } }, include: { incident: true } }),
  ]);
  if (logs.length === 0 && incidents.length === 0 && references.length === 0) {
    console.log("Nada registado para este URL: o artigo nunca chegou ao parser.");
    console.log("Causas possíveis: origem desativada ou só manual, artigo fora das páginas lidas do feed, ou título e etiquetas sem indícios de ocorrência.");
    return;
  }
  for (const log of logs) console.log(`${log.retrievalDate.toISOString().slice(0, 16)} ${log.action} [${log.sourceId}] ${log.reason}`);
  for (const item of incidents) {
    console.log({
      estado: item.verificationStatus,
      tipo: item.category,
      area: `${item.placeName} (${item.precision})`,
      ocorrencia: item.incidentStart.toISOString(),
      publicacao: item.publicationDate.toISOString(),
      fonte: `${item.sourceName} (${item.sourceTier})`,
      outras_fontes: item.references.map((ref) => `${ref.agreement} ${ref.sourceName}`),
      revisao: item.reviewReasons || "-",
      no_mapa: visibilityProblem(item, now) ?? "sim",
    });
  }
  for (const ref of references) console.log(`Fonte adicional (${ref.agreement}${ref.duplicateOfUrl ? ", repetição" : ""}) da ocorrência ${ref.incident.key}`);
}

const index = process.argv.indexOf("--url");
(index > 0 ? trace(process.argv[index + 1] ?? "") : summary())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
