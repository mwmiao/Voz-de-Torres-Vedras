// Uso:
//   npm run update:data
//   npm run update:data -- --source cm-editais --source base-anuncios
//   npm run update:data -- --force     ignora a frequência de cada origem
//   npm run update:data -- --strict    termina com erro se alguma origem falhar

import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { PrismaClient, type SourceRunStatus } from "@prisma/client";
import { SOURCE_CATALOG, type SourceDefinition } from "@/lib/source-catalog";
import { PoliteHttp } from "./fetchers/http";
import { COLLECTORS } from "./sources";
import type { IngestRecord } from "./types";
import { applyRecord, retireMissingOfficials, type ApplyContext } from "./updaters/apply";
import { validateRecord } from "./validators";

type Summary = { id: string; status: SourceRunStatus | "IGNORADA"; created: number; updated: number; unchanged: number; failed: number; message?: string };

function readArgs(argv: string[]) {
  const only: string[] = [];
  for (let i = 0; i < argv.length; i += 1) if (argv[i] === "--source" && argv[i + 1]) only.push(argv[i + 1]);
  return { only, force: argv.includes("--force"), strict: argv.includes("--strict") };
}

async function applyAll(context: ApplyContext, records: IngestRecord[], summary: Summary): Promise<string[]> {
  const errors: string[] = [];
  for (const record of records) {
    const problems = validateRecord(record);
    if (problems.length > 0) {
      summary.failed += 1;
      errors.push(`${record.kind}: ${problems.join("; ")}`);
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

  const dueAt = (state.lastSuccessAt?.getTime() ?? 0) + source.frequencyHours * 3_600_000;
  if (!force && dueAt > now.getTime()) return { ...summary, status: "IGNORADA", message: "ainda dentro da frequência" };

  const run = await db.importRun.create({
    data: { dataset: source.id, dataSourceId: source.id, sourceUrl: source.baseUrl, fileName: "-", sha256: "-", retrievedAt: now },
  });
  const context: ApplyContext = { db, sourceId: source.id, runId: run.id, now, baseline: state.lastSuccessAt === null };

  try {
    await db.source.updateMany({ where: { dataSourceId: source.id, updateStatus: { not: "UNCHANGED" } }, data: { updateStatus: "UNCHANGED" } });
    await db.contract.updateMany({ where: { dataSourceId: source.id, updateStatus: { not: "UNCHANGED" } }, data: { updateStatus: "UNCHANGED" } });

    const collected = await collect({ http, db, revision: state.revision, now });
    const errors = collected.unchanged ? [] : await applyAll(context, collected.records, summary);

    if (!collected.unchanged && collected.complete && source.id === "cm-composicao") {
      const names = collected.records.flatMap((record) => (record.kind === "official" ? [record.name] : []));
      summary.updated += await retireMissingOfficials(context, names, source.baseUrl);
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
  const { only, force, strict } = readArgs(process.argv.slice(2));
  const disabled = (process.env.INGEST_DISABLED_SOURCES ?? "").split(",").map((item) => item.trim());
  const unknown = only.filter((id) => !COLLECTORS[id]);
  if (unknown.length > 0) throw new Error(`Origem desconhecida: ${unknown.join(", ")}`);

  const selected = SOURCE_CATALOG.filter(
    (source) => source.enabled && COLLECTORS[source.id] && !disabled.includes(source.id) && (only.length === 0 || only.includes(source.id)),
  );
  const db = new PrismaClient();
  const http = new PoliteHttp();
  const summaries: Summary[] = [];
  try {
    for (const source of selected) {
      process.stdout.write(`${source.id} ... `);
      const summary = await runSource(db, http, source, force || only.includes(source.id));
      summaries.push(summary);
      console.log(`${summary.status}${summary.message ? ` (${summary.message.slice(0, 160)})` : ""}`);
      http.saveCache();
    }
  } finally {
    await db.$disconnect();
  }

  const total = (key: "created" | "updated" | "unchanged" | "failed") => summaries.reduce((sum, item) => sum + item[key], 0);
  console.table(summaries.map(({ id, status, created, updated, unchanged, failed }) => ({ origem: id, estado: status, novos: created, atualizados: updated, inalterados: unchanged, falhados: failed })));
  console.log(`Total: ${total("created")} novos, ${total("updated")} atualizados, ${total("unchanged")} inalterados, ${total("failed")} falhados.`);

  // Datas de verificação mudam sempre: só registos novos ou alterados justificam publicar dados.
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `alterado=${total("created") + total("updated") > 0}\n`);
  }

  const anyError = summaries.some((item) => item.status === "ERRO" || item.status === "PARCIAL");
  if (strict && anyError) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
