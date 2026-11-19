import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/** Registos de crime com a categoria, filtrados por `where` quando indicado. */
export function listCrimeRecords(where?: Prisma.CrimeRecordWhereInput) {
  return db.crimeRecord.findMany({ where, include: { category: true }, orderBy: [{ year: "desc" }, { category: { order: "asc" } }] });
}

export function listCrimeCategories() {
  return db.crimeCategory.findMany({ orderBy: { order: "asc" } });
}

export function listFreguesias() {
  return db.freguesia.findMany({ orderBy: { name: "asc" } });
}

export function listPopulationEstimates() {
  return db.populationEstimate.findMany({ orderBy: { year: "desc" } });
}

/** O total de crimes dos dois últimos anos, para a página inicial. */
export function listLatestCrimeTotals() {
  return db.crimeRecord.findMany({ where: { categoryCode: "T" }, orderBy: { year: "desc" }, take: 2 });
}
