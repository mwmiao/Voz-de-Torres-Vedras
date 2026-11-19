import { db } from "@/lib/db";
import { olderIncidentWhere, publicIncidentWhere } from "@/lib/incidents";

export function listPublicIncidents(now: Date) {
  return db.incident.findMany({ where: publicIncidentWhere(now), include: { references: true }, orderBy: [{ incidentStart: "desc" }, { publicationDate: "desc" }] });
}

export function countOlderIncidents(now: Date) {
  return db.incident.count({ where: olderIncidentWhere(now) });
}

export function listOlderIncidents(now: Date, take: number) {
  return db.incident.findMany({ where: olderIncidentWhere(now), include: { references: true }, orderBy: { incidentStart: "desc" }, take });
}

export function countArchivedSince(since: Date) {
  return db.incident.count({ where: { archivedAt: { not: null }, incidentStart: { gte: since } } });
}

export function countHeldSince(since: Date) {
  return db.incident.count({ where: { archivedAt: null, heldForReview: true, incidentStart: { gte: since } } });
}

/** A última recolha de ocorrências que não falhou. */
export function findLastIncidentRun(sourceIds: string[]) {
  return db.dataUpdateLog.findFirst({ where: { sourceId: { in: sourceIds }, status: { not: "ERRO" } }, orderBy: { retrievalDate: "desc" } });
}

/** Tudo o que não está retido para revisão, incluindo o arquivo. */
export function listIncidentsForExport() {
  return db.incident.findMany({ where: { heldForReview: false }, include: { references: true }, orderBy: { incidentStart: "desc" } });
}
