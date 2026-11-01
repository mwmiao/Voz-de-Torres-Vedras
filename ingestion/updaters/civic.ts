import type { UpdateStatus } from "@prisma/client";
import { SOURCE_CATALOG } from "@/lib/source-catalog";
import { searchKey } from "@/lib/search";
import { sha256 } from "../fetchers/http";
import { CRIME_CATEGORIES, INE_INDICATOR_URL } from "../parsers/ine";
import type { AlertRecord, CrimeRecordInput, PopulationRecord } from "../types";
import { emit, type ApplyContext } from "./apply";

const AREA = "Torres Vedras";

export async function applyAlert(context: ApplyContext, record: AlertRecord): Promise<UpdateStatus> {
  const { db, sourceId, now } = context;
  const { kind: _kind, key, area, areaType, publishedAt, sourceUrl, ...fields } = record;
  const contentHash = sha256(JSON.stringify([fields.title, fields.description, fields.startsAt, fields.endsAt, fields.severity, area]));
  const definition = SOURCE_CATALOG.find((source) => source.id === sourceId);
  await db.alertSource.upsert({
    where: { id: sourceId },
    update: { retrievalDate: now, updateStatus: "UNCHANGED" },
    create: { id: sourceId, name: definition?.name ?? sourceId, sourceId, sourceUrl: definition?.baseUrl ?? sourceUrl, retrievalDate: now },
  });
  const existing = await db.alert.findUnique({ where: { key } });
  const provenance = {
    sourceUrl,
    publicationDate: publishedAt,
    retrievalDate: now,
    geographicArea: area,
    geographicAreaType: areaType,
    dataPeriod: [fields.startsAt, fields.endsAt].map((date) => date?.toISOString().slice(0, 10) ?? "").join("/"),
  };
  if (existing?.contentHash === contentHash) {
    await db.alert.update({ where: { id: existing.id }, data: { lastCheckedAt: now, retrievalDate: now, updateStatus: "UNCHANGED" } });
    return "UNCHANGED";
  }
  const data = { ...fields, ...provenance, lastCheckedAt: now, contentHash, searchText: searchKey(fields.title, fields.description, area), sourceId };
  if (existing) await db.alert.update({ where: { id: existing.id }, data: { ...data, updateStatus: "UPDATED" } });
  else await db.alert.create({ data: { ...data, key, updateStatus: "NEW" } });
  await emit(context, { entityType: "alerta", entityKey: key, status: existing ? "UPDATED" : "NEW", category: "ALERTA", title: fields.title, sourceUrl, date: publishedAt ?? now });
  return existing ? "UPDATED" : "NEW";
}

/** Avisos que a origem deixou de listar terminam agora: ficam no arquivo, sem desaparecer. */
export async function closeMissingAlerts(context: ApplyContext, keys: string[]): Promise<number> {
  const { db, sourceId, now } = context;
  const { count } = await db.alert.updateMany({
    where: { sourceId, key: { notIn: keys }, endsAt: { gt: now } },
    data: { endsAt: now, updateStatus: "UPDATED", lastCheckedAt: now },
  });
  return count;
}

async function ensureCategories(context: ApplyContext, sourceUrl: string, publishedAt: Date | null) {
  const { db, sourceId, now } = context;
  for (const category of CRIME_CATEGORIES) {
    await db.crimeCategory.upsert({
      where: { code: category.code },
      update: { retrievalDate: now },
      create: { ...category, sourceId, sourceUrl, publicationDate: publishedAt, retrievalDate: now },
    });
  }
}

export async function applyCrime(context: ApplyContext, record: CrimeRecordInput): Promise<UpdateStatus> {
  const { db, sourceId, now } = context;
  await ensureCategories(context, record.sourceUrl, record.publishedAt);
  const dataPeriod = String(record.year);
  const key = { categoryCode_geographicArea_dataPeriod: { categoryCode: record.categoryCode, geographicArea: AREA, dataPeriod } };
  const existing = await db.crimeRecord.findUnique({ where: key });
  const fields = {
    count: record.count,
    confidential: record.confidential,
    officialRate: record.officialRate,
    sourceUrl: record.sourceUrl,
    publicationDate: record.publishedAt,
    retrievalDate: now,
  };
  if (!existing) {
    await db.crimeRecord.create({ data: { ...fields, categoryCode: record.categoryCode, year: record.year, dataPeriod, sourceId } });
    if (record.categoryCode === "T") {
      await emit(context, { entityType: "seguranca", entityKey: dataPeriod, status: "NEW", category: "SEGURANCA", title: `Crimes registados em ${record.year}: dados do INE`, sourceUrl: record.sourceUrl, date: record.publishedAt });
    }
    return "NEW";
  }
  if (existing.count === record.count && existing.officialRate === record.officialRate) {
    await db.crimeRecord.update({ where: { id: existing.id }, data: { retrievalDate: now, updateStatus: "UNCHANGED" } });
    return "UNCHANGED";
  }
  await db.crimeRecord.update({ where: { id: existing.id }, data: { ...fields, updateStatus: "UPDATED" } });
  await emit(context, {
    entityType: "seguranca",
    entityKey: `${dataPeriod}:${record.categoryCode}`,
    status: "UPDATED",
    category: "SEGURANCA",
    title: `Crimes registados em ${record.year}: valor revisto pelo INE`,
    sourceUrl: record.sourceUrl,
    date: record.publishedAt,
    changes: [{ field: "count", oldValue: String(existing.count), newValue: String(record.count) }],
  });
  return "UPDATED";
}

export async function applyPopulation(context: ApplyContext, record: PopulationRecord): Promise<UpdateStatus> {
  const { db, sourceId, now } = context;
  const fields = { population: record.population, sourceUrl: record.sourceUrl, publicationDate: record.publishedAt, retrievalDate: now };
  const existing = await db.populationEstimate.findUnique({ where: { geographicArea_year: { geographicArea: AREA, year: record.year } } });
  if (!existing) {
    await db.populationEstimate.create({ data: { ...fields, year: record.year, dataPeriod: String(record.year), sourceId } });
    return "NEW";
  }
  const changed = existing.population !== record.population;
  await db.populationEstimate.update({ where: { id: existing.id }, data: { ...fields, updateStatus: changed ? "UPDATED" : "UNCHANGED" } });
  return changed ? "UPDATED" : "UNCHANGED";
}

export { INE_INDICATOR_URL };
