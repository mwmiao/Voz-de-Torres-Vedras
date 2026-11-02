// Uso:
//   npm run update:data
//   npm run update:data -- --source cm-editais --source base-anuncios
//   npm run update:data -- --force     ignora a frequência de cada origem
//   npm run update:data -- --strict    termina com erro se alguma origem falhar
//   npm run update:alerts              só as origens de avisos urgentes e de ocorrências recentes

import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { PrismaClient, type SourceRunStatus } from "@prisma/client";
import { SOURCE_CATALOG, type SourceDefinition } from "@/lib/source-catalog";
import { PoliteHttp } from "./fetchers/http";
import { isDue, selectSources } from "./select";
import { COLLECTORS } from "./sources";
import type { CollectStats, IngestRecord } from "./types";
import { deriveAll } from "./derive";
import { applyRecord, retireMissingOfficials, type ApplyContext } from "./updaters/apply";
import { closeMissingAlerts } from "./updaters/civic";
import { logIncident, reconcileIncidents } from "./updaters/incidents";
import { validateRecord } from "./validators";

type Summary = { id: string; status: SourceRunStatus | "IGNORADA"; created: number; updated: number; unchanged: number; failed: number; message?: string; stats?: CollectStats };

function readArgs(argv: string[]) {
  const only: string[] = [];
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === "--source" && argv[i + 1]) only.push(argv[i + 1]);
  return { only, force: argv.includes("--force"), strict: argv.includes("--strict"), alertsOnly: argv.includes("--alertas") };
}

async function applyAll(context: ApplyContext, records: IngestRecord[], summary: Summary): Promise<string[]> {
  const errors: string[] = [];
  for (const record of records) {
    const problems = validateRecord(record);
    if (problems.length > 0) {
      summary.failed += 1;
      errors.push(`${record.kind}: ${problems.join("; ")}`);
      // Uma ocorrência recusada fica no registo de auditoria, com o motivo.
      if (record.kind === "incident") await logIncident(context, "REJEITADO", record.sourceUrl, problems.join("; "));
      continue;
    }
    try {
      const status = await applyRecord(context, record);
      if (status === "NEW") summary.created += 1;
      else if (status === "UPDATED") summary.updated += 1;
      else summary.unchanged += 1;
    } catch (error) {
      summary.failed += 1;
      errors.push(`${record.kind}: ${error instanceof Error ? error.message.slice(-300) : String(error)}`);
    }
  }
  return errors;
}

async function runSource(db: PrismaClient, http: PoliteHttp, source: SourceDefinition, force: boolean): Promise<Summary> {
  const summary: Summary = { id: source.id, status: "OK", created: 0, updated: 0, unchanged: 0, failed: 0 };
  const collect = COLLECTORS[source.id];
  const state = await db.dataSourceState.upsert({ where: { id: source.id }, update: {}, create: { id: source.id } });
  const now = new Date();

  if (!isDue(source, state, now, force)) return { ...summary, status: "IGNORADA", message: "ainda dentro da frequência" };

  const run = await db.importRun.create({
    data: { dataset: source.id, dataSourceId: source.id, sourceUrl: source.baseUrl, fileName: "-", sha256: "-", retrievedAt: now },
  });
  const context: ApplyContext = { db, sourceId: source.id, runId: run.id, now, baseline: state.lastSuccessAt === null };

  try {
    await db.source.updateMany({ where: { dataSourceId: source.id, updateStatus: { not: "UNCHANGED" } }, data: { updateStatus: "UNCHANGED" } });
    await db.contract.updateMany({ where: { dataSourceId: source.id, updateStatus: { not: "UNCHANGED" } }, data: { updateStatus: "UNCHANGED" } });

    const collected = await collect({ http, db, revision: state.revision, now });
    if (!collected.unchanged) summary.stats = collected.stats;
    const errors = collected.unchanged ? [] : await applyAll(context, collected.records, summary);

    if (!collected.unchanged && collected.complete && source.id === "cm-composicao") {
      const names = collected.records.flatMap((record) => (record.kind === "official" ? [record.name] : []));
      summary.updated += await retireMissingOfficials(context, names, source.baseUrl);
    }

    if (!collected.unchanged && collected.complete && source.id === "ipma-avisos") {
      const keys = collected.records.flatMap((record) => (record.kind === "alert" ? [record.key] : []));
      await closeMissingAlerts(context, keys);
    }

    await db.source.updateMany({ where: { dataSourceId: source.id }, data: { retrievedAt: now } });
    await db.contract.updateMany({ where: { dataSourceId: source.id }, data: { updatedAt: now } });

    summary.status = summary.failed > 0 ? "PARCIAL" : "OK";
    if (errors.length > 0) summary.message = errors.slice(0, 3).join(" | ");
    await db.dataSourceState.update({
      where: { id: source.id },
      data: {
        lastRunAt: now,
        lastSuccessAt: now,
        configVersion: source.version ?? null,
        lastStatus: summary.status,
        lastError: summary.message ?? null,
        revision: collected.unchanged ? state.revision : (collected.revision ?? state.revision),
        newCount: summary.created,
        updatedCount: summary.updated,
        unchangedCount: summary.unchanged,
        failedCount: summary.failed,
      },
    });
  } catch (error) {
    // Uma falha nunca apaga dados: o que existe fica como estava.
    summary.status = "ERRO";
    summary.message = error instanceof Error ? error.message : String(error);
    await db.dataSourceState.update({
      where: { id: source.id },
      data: { lastRunAt: now, lastStatus: "ERRO", lastError: summary.message, failedCount: summary.failed },
    });
  }

  await db.dataUpdateLog.create({
    data: {
      status: summary.status,
      newCount: summary.created,
      updatedCount: summary.updated,
      unchangedCount: summary.unchanged,
      failedCount: summary.failed,
      itemsFound: summary.stats?.found,
      itemsConsidered: summary.stats?.considered,
      message: summary.message,
      sourceId: source.id,
      sourceUrl: source.baseUrl,
      retrievalDate: now,
      dataPeriod: now.toISOString().slice(0, 10),
    },
  });

  await db.importRun.update({
    where: { id: run.id },
    data: {
      sha256: createHash("sha256").update(JSON.stringify(summary)).digest("hex"),
      imported: summary.created + summary.updated,
      skipped: summary.unchanged,
      newCount: summary.created,
      updatedCount: summary.updated,
      unchangedCount: summary.unchanged,
      failedCount: summary.failed,
      errors: summary.message ? [summary.message] : undefined,
    },
  });
  return summary;
}

async function main() {
  const { only, force, strict, alertsOnly } = readArgs(process.argv.slice(2));
  const disabled = (process.env.INGEST_DISABLED_SOURCES ?? "").split(",").map((item) => item.trim());
  const unknown = only.filter((id) => !COLLECTORS[id]);
  if (unknown.length > 0) throw new Error(`Origem desconhecida: ${unknown.join(", ")}`);

  const selected = selectSources(SOURCE_CATALOG, COLLECTORS, { only, disabled, alertsOnly });
  const db = new PrismaClient();
  const http = new PoliteHttp();
  const summaries: Summary[] = [];
  const runStartedAt = new Date();
  try {
    for (const source of selected) {
      process.stdout.write(`${source.id} ... `);
      const summary = await runSource(db, http, source, force || only.includes(source.id));
      summaries.push(summary);
      console.log(`${summary.status}${summary.message ? ` (${summary.message.slice(0, 160)})` : ""}`);
      http.saveCache();
    }
    // Estado, revisão e arquivo das ocorrências, a partir de todas as fontes recolhidas.
    if (selected.some((source) => source.group === "ocorrencias")) {
      const reconciled = await reconcileIncidents(db, { now: new Date(), runStartedAt });
      console.log(`Ocorrências: ${reconciled.updated} reavaliadas, ${reconciled.archived} arquivadas, ${reconciled.pending} por rever.`);
    }
    const derived = await deriveAll(db);
    console.log(`Derivados: ${derived.summaries} resumos e ${derived.metrics} métricas atualizados.`);
  } finally {
    await db.$disconnect();
  }

  const total = (key: "created" | "updated" | "unchanged" | "failed") => summaries.reduce((sum, item) => sum + item[key], 0);
  console.table(summaries.map(({ id, status, created, updated, unchanged, failed }) => ({ origem: id, estado: status, novos: created, atualizados: updated, inalterados: unchanged, falhados: failed })));
  console.log(`Total: ${total("created")} novos, ${total("updated")} atualizados, ${total("unchanged")} inalterados, ${total("failed")} falhados.`);

  // Datas de verificação mudam sempre: só registos novos ou alterados justificam publicar dados.
  if (process.env.GITHUB_OUTPUT) {
    // Os avisos e as ocorrências passam depressa: sozinhos, não justificam um pull request.
    const alerts = new Set(SOURCE_CATALOG.filter((source) => source.group !== undefined).map((source) => source.id));
    const changed = summaries.some((item) => !alerts.has(item.id) && item.created + item.updated > 0);
    appendFileSync(process.env.GITHUB_OUTPUT, `alterado=${changed}\n`);
  }

  const anyError = summaries.some((item) => item.status === "ERRO" || item.status === "PARCIAL");
  if (strict && anyError) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
