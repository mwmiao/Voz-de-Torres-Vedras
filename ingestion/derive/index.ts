import type { Prisma, PrismaClient } from "@prisma/client";
import { FREGUESIAS, FREGUESIAS_URL } from "@/lib/alerts";
import { isPersonSupplier, PERSON_SUPPLIER_LABEL } from "@/lib/import/base";
import { searchKey } from "@/lib/search";
import { summarizeContract, summarizeDecision, summarizeMeeting, summarizeSource, type SummaryDraft } from "@/lib/summaries";
import { sha256 } from "../fetchers/http";
import { detectFreguesias } from "../parsers/alertas";

const AREA = "Torres Vedras";
const CONSULTATION_WINDOW_DAYS = 45;
const TOP_SUPPLIERS = 10;
const WRITE_BATCH = 500;

const BASE_URL = "https://dados.gov.pt/pt/datasets/contratos-publicos-portal-base-impic-contratos-de-2012-a-2026/";
const MEETINGS_URL = "https://www.am-tvedras.pt/sessoes/editais/";
const STATUS_URL = "/estado-das-fontes";

async function syncFreguesias(db: PrismaClient, now: Date) {
  for (const { slug, name } of FREGUESIAS) {
    await db.freguesia.upsert({
      where: { slug },
      update: { retrievalDate: now },
      create: { slug, name, sourceId: "cm-freguesias", sourceUrl: FREGUESIAS_URL, retrievalDate: now, geographicArea: name, dataPeriod: "2026" },
    });
  }
}

/** Contratos gravados antes de reconhecer NIF mascarados: o nome deixa de ser republicado. */
async function scrubPersonSuppliers(db: PrismaClient): Promise<number> {
  const contracts = await db.contract.findMany({ where: { supplierIsPerson: false }, select: { id: true, title: true, supplierName: true, supplierNif: true } });
  const people = contracts.filter((contract) => contract.supplierName.split("; ").some((name) => isPersonSupplier(contract.supplierNif, name)));
  const writes = people.map((contract) =>
    db.contract.update({
      where: { id: contract.id },
      data: { supplierName: PERSON_SUPPLIER_LABEL, supplierNif: null, supplierIsPerson: true, searchText: searchKey(contract.title, PERSON_SUPPLIER_LABEL) },
    }),
  );
  for (let start = 0; start < writes.length; start += WRITE_BATCH) await db.$transaction(writes.slice(start, start + WRITE_BATCH));
  await db.$executeRawUnsafe(`UPDATE "Contract" SET "supplierName" = replace("supplierName", '&amp;', '&') WHERE "supplierName" LIKE '%&amp;%'`);
  return writes.length;
}

async function buildSummaries(db: PrismaClient, now: Date): Promise<number> {
  const official = { where: { official: true }, select: { url: true, official: true } };
  const [decisions, meetings, contracts, sources, existing] = await Promise.all([
    db.decision.findMany({ include: { meeting: true, sources: official } }),
    db.meeting.findMany({ include: { decisions: { select: { outcome: true } }, sources: official } }),
    db.contract.findMany({ include: { sources: official } }),
    db.source.findMany({ where: { official: true, type: { in: ["REGULAMENTO", "ORCAMENTO", "CONCURSO", "ATA", "MINUTA", "EDITAL", "DOCUMENTO_PDF"] } } }),
    db.summary.findMany({ select: { id: true, entityType: true, entityKey: true, contentHash: true } }),
  ]);
  const drafts = [
    ...decisions.map(summarizeDecision),
    ...meetings.map((meeting) => summarizeMeeting(meeting, now)),
    ...contracts.map(summarizeContract),
    ...sources.map(summarizeSource),
  ].filter((draft): draft is SummaryDraft => draft !== null);

  const known = new Map(existing.map((row) => [`${row.entityType}|${row.entityKey}`, row]));
  const writes: Prisma.PrismaPromise<unknown>[] = [];
  for (const draft of drafts) {
    const { date, ...fields } = draft;
    const contentHash = sha256(JSON.stringify([fields.simple, fields.meaning, fields.status, fields.sourceUrl, fields.available, date]));
    const current = known.get(`${draft.entityType}|${draft.entityKey}`);
    if (current?.contentHash === contentHash) continue;
    const data = {
      ...fields,
      date,
      contentHash,
      searchText: searchKey(fields.title, fields.simple ?? ""),
      sourceId: "resumos-regras",
      publicationDate: date,
      retrievalDate: now,
      dataPeriod: date?.toISOString().slice(0, 4) ?? "",
    };
    writes.push(current ? db.summary.update({ where: { id: current.id }, data: { ...data, updateStatus: "UPDATED" } }) : db.summary.create({ data }));
  }
  // Numa transação por lote: uma escrita de cada vez demoraria minutos num NAS.
  for (let start = 0; start < writes.length; start += WRITE_BATCH) await db.$transaction(writes.slice(start, start + WRITE_BATCH));
  return writes.length;
}

type MetricRow = { key: string; dimension?: string; period: string; value: number; unit: string; sourceId: string; sourceUrl: string; publicationDate?: Date | null };

function yearOf(date: Date | null | undefined): string | null {
  return date ? String(date.getUTCFullYear()) : null;
}

/** Soma por chave, para agrupar sem repetir contas em cada métrica. */
function tally(rows: Map<string, MetricRow>, row: MetricRow) {
  const id = `${row.key}|${row.dimension ?? ""}|${row.period}`;
  const current = rows.get(id);
  if (current) current.value += row.value;
  else rows.set(id, { ...row });
}

async function buildMetrics(db: PrismaClient, now: Date): Promise<number> {
  const rows = new Map<string, MetricRow>();

  const meetings = await db.meeting.findMany({ where: { date: { lte: now } }, select: { date: true, body: true } });
  for (const meeting of meetings) {
    const shared = { period: yearOf(meeting.date)!, value: 1, unit: "reuniões", sourceId: "transcricao-oficial", sourceUrl: MEETINGS_URL };
    tally(rows, { ...shared, key: "reunioes" });
    tally(rows, { ...shared, key: "reunioes-orgao", dimension: meeting.body });
  }

  const decisions = await db.decision.findMany({ select: { outcome: true, meeting: { select: { date: true } } } });
  for (const decision of decisions) {
    tally(rows, { key: "decisoes", dimension: decision.outcome, period: yearOf(decision.meeting.date)!, value: 1, unit: "decisões", sourceId: "transcricao-oficial", sourceUrl: MEETINGS_URL });
  }

  const contracts = await db.contract.findMany({ select: { signedAt: true, publishedAt: true, priceEur: true, procedureType: true, supplierName: true, supplierIsPerson: true } });
  const supplierTotals = new Map<string, MetricRow>();
  for (const contract of contracts) {
    const period = yearOf(contract.signedAt ?? contract.publishedAt);
    if (!period) continue;
    const value = Number(contract.priceEur);
    const shared = { period, sourceId: "base-contratos", sourceUrl: BASE_URL };
    tally(rows, { ...shared, key: "contratos-numero", value: 1, unit: "contratos" });
    tally(rows, { ...shared, key: "contratos-valor", value, unit: "EUR" });
    tally(rows, { ...shared, key: "contratos-procedimento", dimension: contract.procedureType, value: 1, unit: "contratos" });
    // Pessoas singulares não são agrupadas: o nome não é republicado.
    if (!contract.supplierIsPerson) tally(supplierTotals, { ...shared, key: "contratos-fornecedor", dimension: contract.supplierName, value, unit: "EUR" });
  }
  const byYear = new Map<string, MetricRow[]>();
  for (const row of supplierTotals.values()) byYear.set(row.period, [...(byYear.get(row.period) ?? []), row]);
  for (const list of byYear.values()) {
    for (const row of list.sort((a, b) => b.value - a.value).slice(0, TOP_SUPPLIERS)) tally(rows, row);
  }

  const budget = await db.budgetEntry.findMany({ where: { kind: { in: ["RESUMO", "DESPESA"] } }, include: { sources: { where: { official: true }, take: 1 } } });
  for (const entry of budget) {
    if (!entry.sources[0]) continue;
    tally(rows, { key: "orcamento", dimension: entry.label, period: String(entry.year), value: Number(entry.amountEur), unit: "EUR", sourceId: entry.dataSourceId ?? "transcricao-oficial", sourceUrl: entry.sources[0].url });
  }

  const documents = await db.source.findMany({ where: { official: true, type: { in: ["REGULAMENTO", "EDITAL", "ATA", "MINUTA", "ORCAMENTO"] } }, select: { type: true, publishedAt: true, firstSeenAt: true } });
  for (const document of documents) {
    const period = yearOf(document.publishedAt);
    if (period) tally(rows, { key: "documentos", dimension: document.type, period, value: 1, unit: "documentos", sourceId: "catalogo-documentos", sourceUrl: "/fontes" });
  }

  const events = await db.updateEvent.findMany({ where: { status: "NEW" }, select: { occurredAt: true } });
  for (const event of events) {
    tally(rows, { key: "registos-novos", period: event.occurredAt.toISOString().slice(0, 7), value: 1, unit: "registos", sourceId: "registo-atualizacoes", sourceUrl: STATUS_URL });
  }
  const logs = await db.dataUpdateLog.findMany({ select: { retrievalDate: true } });
  for (const log of logs) {
    tally(rows, { key: "execucoes", period: log.retrievalDate.toISOString().slice(0, 7), value: 1, unit: "execuções", sourceId: "registo-atualizacoes", sourceUrl: STATUS_URL });
  }

  const existing = await db.metric.findMany();
  const known = new Map(existing.map((row) => [`${row.key}|${row.dimension}|${row.period}`, row]));
  const writes: Prisma.PrismaPromise<unknown>[] = [];
  for (const [id, row] of rows) {
    const current = known.get(id);
    known.delete(id);
    if (current?.value === row.value) {
      continue;
    }
    const data = { ...row, dimension: row.dimension ?? "", publicationDate: row.publicationDate ?? null, retrievalDate: now, geographicArea: AREA, dataPeriod: row.period };
    writes.push(current ? db.metric.update({ where: { id: current.id }, data: { ...data, updateStatus: "UPDATED" } }) : db.metric.create({ data }));
  }
  // Um valor que deixou de existir na origem não pode continuar a ser mostrado.
  if (known.size > 0) writes.push(db.metric.deleteMany({ where: { id: { in: [...known.values()].map((row) => row.id) } } }));
  for (let start = 0; start < writes.length; start += WRITE_BATCH) await db.$transaction(writes.slice(start, start + WRITE_BATCH));
  await db.metric.updateMany({ data: { retrievalDate: now } });
  return writes.length;
}

/** Taxa por 1 000 residentes, com a população do mesmo ano ou, na sua falta, da mais recente. */
async function buildCrimeRates(db: PrismaClient) {
  const population = await db.populationEstimate.findMany({ where: { geographicArea: AREA }, orderBy: { year: "desc" } });
  if (population.length === 0) return;
  const records = await db.crimeRecord.findMany({ where: { count: { not: null } } });
  for (const record of records) {
    const reference = population.find((row) => row.year <= record.year) ?? population[population.length - 1];
    const calculatedRate = Math.round(((record.count ?? 0) / reference.population) * 1000 * 100) / 100;
    if (record.calculatedRate === calculatedRate && record.populationYear === reference.year) continue;
    await db.crimeRecord.update({ where: { id: record.id }, data: { calculatedRate, populationYear: reference.year } });
  }
}

/** As consultas públicas chegam como documentos oficiais: as recentes são também avisos. */
async function buildConsultations(db: PrismaClient, now: Date) {
  const since = new Date(now.getTime() - CONSULTATION_WINDOW_DAYS * 86_400_000);
  const sources = await db.source.findMany({
    where: { official: true, publishedAt: { gte: since }, OR: [{ searchText: { contains: "consulta publica" } }, { searchText: { contains: "discussao publica" } }] },
  });
  if (sources.length === 0) return;
  await db.alertSource.upsert({
    where: { id: "documentos-consulta" },
    update: { retrievalDate: now },
    create: { id: "documentos-consulta", name: "Documentos oficiais recolhidos", sourceId: "documentos-consulta", sourceUrl: "/fontes", retrievalDate: now },
  });
  for (const source of sources) {
    const freguesias = detectFreguesias(source.title);
    const description = `Documento oficial publicado por ${source.name}. As datas e a forma de participar constam do documento.`;
    const shared = {
      title: source.title,
      description,
      type: "CONSULTA" as const,
      severity: "INFORMATIVO" as const,
      startsAt: source.publishedAt,
      endsAt: new Date((source.publishedAt ?? now).getTime() + CONSULTATION_WINDOW_DAYS * 86_400_000),
      hasOfficialEnd: false,
      lastCheckedAt: now,
      contentHash: sha256(source.title),
      searchText: searchKey(source.title, description),
      sourceId: "documentos-consulta",
      sourceUrl: source.url,
      publicationDate: source.publishedAt,
      retrievalDate: now,
      geographicArea: freguesias.length > 0 ? freguesias.join(", ") : "Concelho de Torres Vedras",
      geographicAreaType: freguesias.length > 0 ? ("FREGUESIA" as const) : ("CONCELHO" as const),
    };
    await db.alert.upsert({ where: { key: `consulta|${source.url}` }, update: { lastCheckedAt: now, retrievalDate: now }, create: { ...shared, key: `consulta|${source.url}` } });
  }
}

/** Calcula o que deriva dos registos oficiais. Pode ser repetido: só escreve o que mudou. */
export async function deriveAll(db: PrismaClient, now = new Date()) {
  await syncFreguesias(db, now);
  await scrubPersonSuppliers(db);
  await buildCrimeRates(db);
  await buildConsultations(db, now);
  const summaries = await buildSummaries(db, now);
  const metrics = await buildMetrics(db, now);
  return { summaries, metrics };
}
