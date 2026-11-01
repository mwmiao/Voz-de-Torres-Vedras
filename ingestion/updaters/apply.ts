import type { MeetingStatus, Prisma, PrismaClient, UpdateCategory, UpdateStatus } from "@prisma/client";
import { slugify } from "@/lib/import/records";
import { searchKey } from "@/lib/search";
import { isOfficialUrl } from "@/lib/sources";
import { sha256 } from "../fetchers/http";
import type { ContractRecord, DocumentRecord, FinanceRecord, IngestRecord, MeetingRecord, ModificationRecord, OfficialRecord } from "../types";
import { diffFields, type Change } from "./diff";

/** Na primeira execução, só o que é recente aparece como novidade: o resto é o arquivo existente. */
const BASELINE_WINDOW_DAYS = 45;

export type ApplyContext = {
  db: PrismaClient;
  sourceId: string;
  runId: string;
  now: Date;
  baseline: boolean;
};

type EventInput = {
  entityType: string;
  entityKey: string;
  status: UpdateStatus;
  category: UpdateCategory;
  title: string;
  sourceUrl: string;
  date?: Date | null;
  changes?: Change[];
};

async function emit(context: ApplyContext, event: EventInput) {
  if (context.baseline) {
    const limit = context.now.getTime() - BASELINE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (event.status !== "NEW" || !event.date || event.date.getTime() < limit) return;
  }
  const { date, changes = [], ...fields } = event;
  await context.db.updateEvent.create({
    data: {
      ...fields,
      dataSourceId: context.sourceId,
      runId: context.runId,
      occurredAt: context.baseline && date ? date : context.now,
      changes: { create: changes },
    },
  });
}

function documentHash(record: DocumentRecord): string {
  return sha256(JSON.stringify([record.title, record.docType, record.publishedAt?.toISOString() ?? null, record.data ?? null]));
}

async function applyDocument(context: ApplyContext, record: DocumentRecord): Promise<UpdateStatus> {
  const { db, sourceId, now } = context;
  const contentHash = documentHash(record);
  const existing = await db.source.findUnique({ where: { url: record.url } });
  const fields = {
    name: record.publisher,
    title: record.title,
    type: record.docType,
    publishedAt: record.publishedAt ?? null,
    data: (record.data ?? undefined) as Prisma.InputJsonValue | undefined,
    searchText: searchKey(record.title, record.publisher),
    contentHash,
    dataSourceId: sourceId,
    retrievedAt: now,
  };

  if (!existing) {
    await db.source.create({
      data: { ...fields, url: record.url, official: isOfficialUrl(record.url, record.docType), updateStatus: "NEW", firstSeenAt: now },
    });
    await emit(context, { entityType: "documento", entityKey: record.url, status: "NEW", category: record.category, title: record.title, sourceUrl: record.url, date: record.publishedAt });
    return "NEW";
  }

  // Fonte transcrita à mão: passa a ser acompanhada, mas mantém o título já revisto.
  if (!existing.contentHash) {
    await db.source.update({
      where: { id: existing.id },
      data: { contentHash, dataSourceId: sourceId, retrievedAt: now, publishedAt: existing.publishedAt ?? fields.publishedAt, data: fields.data },
    });
    return "UNCHANGED";
  }
  if (existing.contentHash === contentHash) return "UNCHANGED";

  const changes = diffFields<typeof fields>(existing, fields, ["title", "publishedAt"]);
  await db.source.update({ where: { id: existing.id }, data: { ...fields, updateStatus: "UPDATED" } });
  if (changes.length === 0) return "UNCHANGED";
  await emit(context, { entityType: "documento", entityKey: record.url, status: "UPDATED", category: record.category, title: record.title, sourceUrl: record.url, date: record.publishedAt, changes });
  return "UPDATED";
}

const CONTRACT_FIELDS = ["title", "supplierName", "supplierNif", "procedureType", "contractType", "cpvCode", "priceEur", "signedAt", "publishedAt", "durationDays"] as const;

async function applyContract(context: ApplyContext, record: ContractRecord): Promise<UpdateStatus> {
  const { db, sourceId, now, runId } = context;
  const { kind: _kind, sourceUrl, ...contract } = record;
  const shared = {
    ...contract,
    searchText: searchKey(contract.title, contract.supplierName),
    dataSourceId: sourceId,
    updatedAt: now,
    importRunId: runId,
  };
  const existing = await db.contract.findUnique({ where: { baseId: record.baseId } });

  if (!existing) {
    await db.contract.create({
      data: {
        ...shared,
        updateStatus: "NEW",
        sources: {
          connectOrCreate: {
            where: { url: sourceUrl },
            create: {
              name: "Portal BASE (IMPIC)",
              title: `Contrato n.º ${record.baseId}`,
              url: sourceUrl,
              type: "CONTRATO",
              official: isOfficialUrl(sourceUrl),
              publishedAt: record.publishedAt,
              retrievedAt: now,
              dataSourceId: sourceId,
              searchText: searchKey(`Contrato n.º ${record.baseId}`),
            },
          },
        },
      },
    });
    await emit(context, { entityType: "contrato", entityKey: record.baseId, status: "NEW", category: "CONTRATO", title: record.title, sourceUrl, date: record.publishedAt ?? record.signedAt });
    return "NEW";
  }

  const changes = diffFields<typeof contract>(existing, contract, [...CONTRACT_FIELDS]);
  if (changes.length === 0) return "UNCHANGED";
  await db.contract.update({ where: { id: existing.id }, data: { ...shared, updateStatus: "UPDATED" } });
  await emit(context, { entityType: "contrato", entityKey: record.baseId, status: "UPDATED", category: "CONTRATO", title: record.title, sourceUrl, date: record.publishedAt, changes });
  return "UPDATED";
}

async function applyModification(context: ApplyContext, record: ModificationRecord): Promise<UpdateStatus> {
  const { db, sourceId, now } = context;
  const { kind: _kind, ...modification } = record;
  const existing = await db.contractModification.findFirst({
    where: { baseId: record.baseId, date: record.date, actType: record.actType },
  });
  if (existing) return "UNCHANGED";
  await db.contractModification.create({ data: { ...modification, dataSourceId: sourceId, updatedAt: now } });
  const contract = await db.contract.findUnique({ where: { baseId: record.baseId }, select: { title: true } });
  await emit(context, {
    entityType: "modificacao",
    entityKey: `${record.baseId}:${record.date?.toISOString()}`,
    status: "NEW",
    category: "CONTRATO",
    title: `Modificação contratual: ${contract?.title ?? record.baseId}`,
    sourceUrl: record.sourceUrl,
    date: record.publishedAt ?? record.date,
  });
  return "NEW";
}

function meetingSlug(record: MeetingRecord): string {
  const prefix = record.body === "ASSEMBLEIA_MUNICIPAL" ? "am" : "cm";
  return `${prefix}-${record.date.toISOString().slice(0, 10)}`;
}

async function applyMeeting(context: ApplyContext, record: MeetingRecord): Promise<UpdateStatus> {
  const { db, sourceId, now } = context;
  const slug = meetingSlug(record);
  const source = await db.source.findUnique({ where: { url: record.sourceUrl }, select: { id: true } });
  const link = source ? { sources: { connect: { id: source.id } } } : {};
  const status: MeetingStatus = record.date > now ? "CONVOCADA" : "REALIZADA";
  const existing = await db.meeting.findUnique({ where: { slug } });

  if (!existing) {
    await db.meeting.create({
      data: {
        slug,
        body: record.body,
        date: record.date,
        hasTime: record.hasTime,
        title: record.title,
        location: record.location,
        status,
        dataSourceId: sourceId,
        updateStatus: "NEW",
        updatedAt: now,
        ...link,
      },
    });
    await emit(context, { entityType: "reuniao", entityKey: slug, status: "NEW", category: "REUNIAO", title: record.title, sourceUrl: record.sourceUrl, date: record.date });
    return "NEW";
  }

  // Só se preenche o que falta: o que já foi transcrito de uma fonte oficial não é substituído.
  const next = {
    location: existing.location ?? record.location,
    date: existing.hasTime ? existing.date : record.date,
    hasTime: existing.hasTime || record.hasTime,
    status,
  };
  const changes = diffFields<typeof next>(existing, next, ["location", "date", "status"]);
  await db.meeting.update({ where: { id: existing.id }, data: { ...next, ...link, updateStatus: changes.length ? "UPDATED" : "UNCHANGED" } });
  if (changes.length === 0) return "UNCHANGED";
  await emit(context, { entityType: "reuniao", entityKey: slug, status: "UPDATED", category: "REUNIAO", title: existing.title, sourceUrl: record.sourceUrl, date: record.date, changes });
  return "UPDATED";
}

async function applyOfficial(context: ApplyContext, record: OfficialRecord): Promise<UpdateStatus> {
  const { db, sourceId, now } = context;
  const slug = slugify(record.name);
  const fields = { name: record.name, role: record.role, party: record.party, portfolios: record.portfolios };
  const source = await db.source.findUnique({ where: { url: record.sourceUrl }, select: { id: true } });
  const existing = await db.official.findUnique({ where: { slug } });

  if (!existing) {
    await db.official.create({
      data: {
        ...fields,
        slug,
        body: "EXECUTIVO_MUNICIPAL",
        dataSourceId: sourceId,
        updateStatus: "NEW",
        updatedAt: now,
        sources: source ? { connect: { id: source.id } } : undefined,
      },
    });
    await emit(context, { entityType: "eleito", entityKey: slug, status: "NEW", category: "ELEITO", title: `${record.name} (${record.role})`, sourceUrl: record.sourceUrl, date: now });
    return "NEW";
  }

  const changes = diffFields<typeof fields>(existing, fields, ["role", "party", "portfolios"]);
  const reactivated = !existing.active;
  if (changes.length === 0 && !reactivated) {
    await db.official.update({ where: { id: existing.id }, data: { dataSourceId: sourceId, updatedAt: now } });
    return "UNCHANGED";
  }
  await db.official.update({
    where: { id: existing.id },
    data: { ...fields, active: true, dataSourceId: sourceId, updatedAt: now, updateStatus: "UPDATED" },
  });
  await emit(context, { entityType: "eleito", entityKey: slug, status: "UPDATED", category: "ELEITO", title: `${record.name} (${record.role})`, sourceUrl: record.sourceUrl, date: now, changes });
  return "UPDATED";
}

async function applyFinance(context: ApplyContext, record: FinanceRecord): Promise<UpdateStatus> {
  const { db, sourceId, now } = context;
  const key = { year: record.year, kind: record.budgetKind, label: record.label, asOf: record.asOf };
  const existing = await db.budgetEntry.findFirst({ where: key });
  if (existing) return "UNCHANGED";
  const source = await db.source.findUnique({ where: { url: record.sourceUrl }, select: { id: true } });
  await db.budgetEntry.create({
    data: {
      ...key,
      amountEur: record.amountEur,
      dataSourceId: sourceId,
      updateStatus: "NEW",
      updatedAt: now,
      sources: source ? { connect: { id: source.id } } : undefined,
    },
  });
  await emit(context, { entityType: "orcamento", entityKey: `${record.label}:${record.asOf.toISOString()}`, status: "NEW", category: "ORCAMENTO", title: record.label, sourceUrl: record.sourceUrl, date: record.asOf });
  return "NEW";
}

export function applyRecord(context: ApplyContext, record: IngestRecord): Promise<UpdateStatus> {
  switch (record.kind) {
    case "document":
      return applyDocument(context, record);
    case "contract":
      return applyContract(context, record);
    case "modification":
      return applyModification(context, record);
    case "meeting":
      return applyMeeting(context, record);
    case "official":
      return applyOfficial(context, record);
    case "finance":
      return applyFinance(context, record);
  }
}

/** Eleitos que deixaram de constar da página oficial ficam inativos, com registo da alteração. */
export async function retireMissingOfficials(context: ApplyContext, names: string[], sourceUrl: string): Promise<number> {
  const { db, now } = context;
  const present = new Set(names.map(slugify));
  const current = await db.official.findMany({ where: { body: "EXECUTIVO_MUNICIPAL", active: true } });
  let retired = 0;
  for (const official of current.filter((item) => !present.has(item.slug))) {
    await db.official.update({ where: { id: official.id }, data: { active: false, updatedAt: now, updateStatus: "UPDATED" } });
    await emit(context, {
      entityType: "eleito",
      entityKey: official.slug,
      status: "UPDATED",
      category: "ELEITO",
      title: `${official.name} deixou de constar da composição`,
      sourceUrl,
      date: now,
      changes: [{ field: "active", oldValue: "true", newValue: "false" }],
    });
    retired += 1;
  }
  return retired;
}
