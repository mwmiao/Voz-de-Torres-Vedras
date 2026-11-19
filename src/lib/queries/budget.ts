import { db } from "@/lib/db";

export function listBudgetEntries() {
  return db.budgetEntry.findMany({ include: { sources: true }, orderBy: [{ amountEur: "desc" }] });
}

export function listBudgetEntriesForExport() {
  return db.budgetEntry.findMany({ include: { sources: true }, orderBy: [{ year: "desc" }, { kind: "asc" }, { asOf: "desc" }] });
}

/** Documentos oficiais do orçamento, os mais recentes primeiro. */
export function listBudgetDocuments() {
  return db.source.findMany({ where: { type: "ORCAMENTO", official: true }, orderBy: { publishedAt: { sort: "desc", nulls: "last" } }, take: 24 });
}
