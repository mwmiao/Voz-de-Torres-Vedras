import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { BASE_DATASET_URL, normalizeBaseRecord, type BaseRecord, type NormalizedContract } from "./base";
import { parseRows, slugify, validateBudgetRows, validateDecisionRows, type RowError } from "./records";

export type ImportSummary = { imported: number; skipped: number; errors: RowError[]; runId: string };

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/** Importa contratos no formato IMPIC, mantendo apenas os do Município e dos SMAS. */
export async function importBaseContracts(
  db: PrismaClient,
  fileName: string,
  content: string,
  retrievedAt = new Date(),
): Promise<ImportSummary> {
  const records = JSON.parse(content) as BaseRecord[];
  const run = await db.importRun.create({
    data: { dataset: "portal-base-contratos", sourceUrl: BASE_DATASET_URL, fileName, sha256: sha256(content), retrievedAt },
  });

  // O conjunto traz alguns identificadores repetidos: vale o último registo de cada um.
  const contracts = new Map<string, NormalizedContract>();
  let skipped = 0;
  for (const record of records) {
    const contract = normalizeBaseRecord(record);
    if (contract) contracts.set(contract.baseId, contract);
    else skipped += 1;
  }
  skipped += records.length - skipped - contracts.size;

  for (const contract of contracts.values()) {
    const { sourceUrl, ...fields } = contract;
    await db.contract.upsert({
      where: { baseId: contract.baseId },
      update: { ...fields, updatedAt: retrievedAt, importRunId: run.id },
      create: {
        ...fields,
        updatedAt: retrievedAt,
        importRunId: run.id,
        sources: {
          connectOrCreate: {
            where: { url: sourceUrl },
            create: {
              name: "Portal BASE (IMPIC)",
              title: `Contrato n.º ${contract.baseId}`,
              url: sourceUrl,
              type: "CONTRATO",
              publishedAt: contract.publishedAt,
              retrievedAt,
              importRunId: run.id,
            },
          },
        },
      },
    });
  }

  const imported = contracts.size;
  await db.importRun.update({ where: { id: run.id }, data: { imported, skipped } });
  return { imported, skipped, errors: [], runId: run.id };
}

/** Importa decisões no formato genérico. Linhas inválidas ficam registadas e não entram. */
export async function importDecisions(
  db: PrismaClient,
  fileName: string,
  content: string,
  sourceUrl: string,
  retrievedAt = new Date(),
): Promise<ImportSummary> {
  const { valid, errors } = validateDecisionRows(parseRows(fileName, content));
  const run = await db.importRun.create({
    data: {
      dataset: "decisoes",
      sourceUrl,
      fileName,
      sha256: sha256(content),
      retrievedAt,
      skipped: errors.length,
      errors: errors.length ? errors : undefined,
    },
  });

  for (const row of valid) {
    const meetingSlug = `${row.body === "ASSEMBLEIA_MUNICIPAL" ? "am" : "cm"}-${row.meetingDate}`;
    const meeting = await db.meeting.upsert({
      where: { slug: meetingSlug },
      update: {},
      create: {
        slug: meetingSlug,
        body: row.body,
        date: new Date(`${row.meetingDate}T12:00:00Z`),
        hasTime: false,
        title: row.meetingTitle,
        updatedAt: retrievedAt,
      },
    });
    const source = await db.source.upsert({
      where: { url: row.sourceUrl },
      update: {},
      create: {
        name: row.sourceName,
        title: row.sourceTitle,
        url: row.sourceUrl,
        type: row.sourceType,
        publishedAt: row.sourcePublishedAt ? new Date(row.sourcePublishedAt) : null,
        retrievedAt,
        importRunId: run.id,
      },
    });
    const fields = {
      meetingId: meeting.id,
      itemNumber: row.itemNumber || null,
      proposalRef: row.proposalRef || null,
      title: row.title,
      outcome: row.outcome,
      voteMode: row.voteMode,
      votesFor: row.votesFor ?? null,
      votesAgainst: row.votesAgainst ?? null,
      abstentions: row.abstentions ?? null,
      updatedAt: retrievedAt,
    };
    const slug = slugify(`${meetingSlug} ${row.itemNumber ?? ""} ${row.title}`);
    await db.decision.upsert({
      where: { slug },
      update: { ...fields, sources: { connect: { id: source.id } } },
      create: { ...fields, slug, sources: { connect: { id: source.id } } },
    });
  }

  await db.importRun.update({ where: { id: run.id }, data: { imported: valid.length } });
  return { imported: valid.length, skipped: errors.length, errors, runId: run.id };
}

/** Importa valores orçamentais transcritos dos documentos oficiais. */
export async function importBudget(
  db: PrismaClient,
  fileName: string,
  content: string,
  sourceUrl: string,
  retrievedAt = new Date(),
): Promise<ImportSummary> {
  const { valid, errors } = validateBudgetRows(parseRows(fileName, content));
  const run = await db.importRun.create({
    data: {
      dataset: "orcamento",
      sourceUrl,
      fileName,
      sha256: sha256(content),
      retrievedAt,
      skipped: errors.length,
      errors: errors.length ? errors : undefined,
    },
  });

  for (const row of valid) {
    const source = await db.source.upsert({
      where: { url: row.sourceUrl },
      update: {},
      create: { name: row.sourceName, title: row.sourceTitle, url: row.sourceUrl, type: "ORCAMENTO", retrievedAt, importRunId: run.id },
    });
    const fields = {
      amountEur: row.amountEur,
      approximate: row.approximate,
      note: row.note || null,
      asOf: row.asOf ? new Date(`${row.asOf}T12:00:00Z`) : null,
      updatedAt: retrievedAt,
    };
    const key = { year: row.year, kind: row.kind, label: row.label };
    const existing = await db.budgetEntry.findFirst({ where: key });
    if (existing) await db.budgetEntry.update({ where: { id: existing.id }, data: { ...fields, sources: { set: [{ id: source.id }] } } });
    else await db.budgetEntry.create({ data: { ...key, ...fields, sources: { connect: { id: source.id } } } });
  }

  await db.importRun.update({ where: { id: run.id }, data: { imported: valid.length } });
  return { imported: valid.length, skipped: errors.length, errors, runId: run.id };
}
