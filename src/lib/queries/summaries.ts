import type { Prisma, Summary } from "@prisma/client";
import { db } from "@/lib/db";

export function listSummaries(where: Prisma.SummaryWhereInput, page: number, pageSize: number) {
  return db.summary.findMany({ where, orderBy: [{ date: { sort: "desc", nulls: "last" } }, { title: "asc" }], skip: (page - 1) * pageSize, take: pageSize });
}

export function countSummaries(where: Prisma.SummaryWhereInput) {
  return db.summary.count({ where });
}

export function countSummariesByType(where: Prisma.SummaryWhereInput) {
  return db.summary.groupBy({ by: ["entityType"], where: { ...where, entityType: undefined }, _count: { _all: true }, orderBy: { _count: { entityType: "desc" } } });
}

export function listSummariesForExport() {
  return db.summary.findMany({ orderBy: { date: { sort: "desc", nulls: "last" } } });
}

/** O resumo mais recente de um tipo que já está disponível, para a página inicial. */
export function findLatestSummary(entityType: string, now: Date) {
  return db.summary.findFirst({ where: { available: true, entityType, date: { lte: now } }, orderBy: { date: "desc" } });
}

export async function summaryMap(entityType: string, keys: string[]): Promise<Map<string, Summary>> {
  const rows = await db.summary.findMany({ where: { entityType, entityKey: { in: keys } } });
  return new Map(rows.map((row) => [row.entityKey, row]));
}
