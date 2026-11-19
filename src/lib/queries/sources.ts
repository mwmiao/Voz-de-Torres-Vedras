import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export function listSources(where: Prisma.SourceWhereInput, page: number, pageSize: number) {
  return db.source.findMany({
    where,
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { title: "asc" }],
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
}

export function countSources(where: Prisma.SourceWhereInput) {
  return db.source.count({ where });
}

export function countSourcesByType() {
  return db.source.groupBy({ by: ["type"], _count: { _all: true } });
}

export function latestSourceRetrieval() {
  return db.source.aggregate({ _max: { retrievedAt: true } });
}

/** Concursos oficiais mais recentes. */
export function listRecentTenders() {
  return db.source.findMany({ where: { type: "CONCURSO", official: true }, orderBy: { publishedAt: { sort: "desc", nulls: "last" } }, take: 8 });
}

export function listDataSourceStates(ids?: string[]) {
  return db.dataSourceState.findMany(ids ? { where: { id: { in: ids } } } : undefined);
}

/** Quantos registos cada origem de dados já trouxe, por tipo de registo. */
export function countRecordsBySource() {
  return Promise.all([
    db.source.groupBy({ by: ["dataSourceId"], _count: { _all: true } }),
    db.contract.groupBy({ by: ["dataSourceId"], _count: { _all: true } }),
    db.meeting.groupBy({ by: ["dataSourceId"], _count: { _all: true } }),
    db.official.groupBy({ by: ["dataSourceId"], _count: { _all: true } }),
    db.budgetEntry.groupBy({ by: ["dataSourceId"], _count: { _all: true } }),
    db.decision.groupBy({ by: ["dataSourceId"], _count: { _all: true } }),
    db.contractModification.groupBy({ by: ["dataSourceId"], _count: { _all: true } }),
    db.incident.groupBy({ by: ["sourceId"], _count: { _all: true } }),
    db.incidentReference.groupBy({ by: ["sourceId"], _count: { _all: true } }),
  ]);
}
