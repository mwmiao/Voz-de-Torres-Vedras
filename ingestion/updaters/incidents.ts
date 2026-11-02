import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Incident, IncidentLogAction, IncidentReference, PrismaClient, SourceTier, UpdateStatus } from "@prisma/client";
import { WINDOW_DAYS } from "@/lib/incidents";
import { archiveReason, computeVerification, fingerprintSimilarity, isNearDuplicate, matchClaim, mustHold, reviewReasons, thresholdsFromEnv, type Thresholds } from "@/lib/verification";
import { sha256 } from "../fetchers/http";
import type { IncidentRecord, IncidentRejection } from "../types";
import type { ApplyContext } from "./apply";

/** Registos feitos à mão prevalecem sobre a recolha automática da mesma publicação. */
export const CURATED_INCIDENTS = "ocorrencias-curadas";
const DAY_MS = 86_400_000;
/** Abaixo disto, uma publicação editada mudou de forma substancial. */
const SUBSTANTIAL_CHANGE = 0.5;

const unofficial = (tier: SourceTier) => tier === "CONTA_OFICIAL" || tier === "COMUNITARIA";

/** Escreve no registo de auditoria, sem repetir a mesma entrada a cada execução. */
export async function logIncident(context: Pick<ApplyContext, "db" | "sourceId" | "now">, action: IncidentLogAction, sourceUrl: string, reason: string, duplicateOfKey?: string) {
  const { db, sourceId, now } = context;
  const last = await db.incidentLog.findFirst({ where: { sourceUrl }, orderBy: { retrievalDate: "desc" } });
  if (last && last.action === action && last.reason === reason) return;
  await db.incidentLog.create({ data: { action, reason, sourceUrl, duplicateOfKey, sourceId, retrievalDate: now } });
}

export async function applyIncidentRejection(context: ApplyContext, record: IncidentRejection): Promise<UpdateStatus> {
  await logIncident(context, "REJEITADO", record.sourceUrl, record.reason);
  return "UNCHANGED";
}

const placeFields = (record: IncidentRecord) => ({
  freguesiaSlug: record.freguesiaSlug!,
  placeName: record.placeName!,
  precision: record.precision!,
  latitude: record.latitude!,
  longitude: record.longitude!,
  radiusM: record.radiusM,
});

const flagsOf = (record: IncidentRecord) => [...record.flags, ...(record.doubts.length > 0 ? ["ambiguo"] : [])];

/** Um relato é a primeira fonte de uma ocorrência, ou mais uma fonte de uma ocorrência que já existe. */
export async function applyIncident(context: ApplyContext, record: IncidentRecord): Promise<UpdateStatus> {
  const { db, sourceId, now } = context;
  const start = record.incidentStart!;

  // 1. A mesma publicação como primeira fonte.
  const existing = await db.incident.findUnique({ where: { key: record.sourceUrl } });
  if (existing) return updatePrimary(context, existing, record);

  // 2. A mesma publicação como fonte adicional.
  const reference = await db.incidentReference.findFirst({ where: { url: record.sourceUrl } });
  if (reference) {
    const data = { linkPublic: record.linkPublic, engagement: record.engagement, retrievalDate: now, removedAt: record.removed ? (reference.removedAt ?? now) : null };
    const changed = data.linkPublic !== reference.linkPublic || data.engagement !== reference.engagement || Boolean(data.removedAt) !== Boolean(reference.removedAt);
    await db.incidentReference.update({ where: { id: reference.id }, data });
    if (record.removed && !reference.removedAt) await logIncident(context, "ATUALIZADO", record.sourceUrl, "a publicação foi removida pela fonte");
    return changed ? "UPDATED" : "UNCHANGED";
  }
  if (record.removed) return "UNCHANGED";

  // 3. Outra fonte sobre uma ocorrência já registada.
  const candidates = await db.incident.findMany({
    where: { archivedAt: null, incidentStart: { gte: new Date(start.getTime() - 2 * DAY_MS), lte: new Date(start.getTime() + 2 * DAY_MS) } },
    include: { references: true },
  });
  const explicit = record.incidentKey ? candidates.find((item) => item.key === record.incidentKey) : undefined;
  const match = explicit
    ? { candidate: explicit, agreement: record.agreement ?? "CORROBORA", reason: "ligada à mão" }
    : matchClaim({ ...placeFields(record), category: record.category, incidentStart: start, hasTime: record.hasTime, titleFingerprint: record.titleFingerprint, denies: record.denies }, candidates);

  if (match) {
    const incident = candidates.find((item) => item.id === match.candidate.id)!;
    const duplicateOf = findDuplicateOf(record, incident, incident.references);
    await db.incidentReference.create({
      data: {
        incidentId: incident.id,
        sourceName: record.sourceName,
        sourceTier: record.sourceTier,
        url: record.sourceUrl,
        independenceKey: record.independenceKey,
        author: record.author,
        articleCategory: record.articleCategory ?? null,
        publicationDate: record.publishedAt!,
        claim: record.claim,
        agreement: match.agreement,
        duplicateOfUrl: duplicateOf,
        titleFingerprint: record.titleFingerprint,
        linkPublic: record.linkPublic,
        engagement: record.engagement,
        sourceId,
        retrievalDate: now,
      },
    });
    // Só autoridades e imprensa podem tornar a localização ou a hora mais precisas.
    if (match.agreement === "ACRESCENTA" && !unofficial(record.sourceTier) && record.category !== "VIOLENCIA_DOMESTICA") {
      await db.incident.update({ where: { id: incident.id }, data: { ...placeFields(record), geographicArea: record.placeName!, hasTime: record.hasTime || incident.hasTime, incidentStart: record.hasTime ? start : incident.incidentStart } });
    }
    if (duplicateOf) await logIncident(context, "DUPLICADO", record.sourceUrl, `repete ${duplicateOf}: não conta como fonte independente`, incident.key);
    else await logIncident(context, "ATUALIZADO", incident.key, `nova fonte (${record.sourceName}): ${match.agreement.toLowerCase()}, ${match.reason}`, record.sourceUrl);
    return "UPDATED";
  }

  // 4. Uma ocorrência nova.
  const flags = flagsOf(record);
  const verification = computeVerification({ primaryTier: record.sourceTier, phase: record.phase, developing: flags.includes("em-desenvolvimento"), firstReportedAt: record.publishedAt!, now, sources: [{ sourceTier: record.sourceTier, agreement: "PRINCIPAL", independenceKey: record.independenceKey }] });
  const held = mustHold({ primaryTier: record.sourceTier, category: record.category, flags }, record.doubts.length > 0);
  const data = {
    key: record.sourceUrl,
    category: record.category,
    tags: record.tags.join(", "),
    summary: record.summary,
    titleFingerprint: record.titleFingerprint,
    textFingerprint: record.textFingerprint,
    sourceName: record.sourceName,
    sourceTier: record.sourceTier,
    independenceKey: record.independenceKey,
    author: record.author,
    articleCategory: record.articleCategory ?? null,
    sourceLinkPublic: record.linkPublic,
    sourceLinkNote: record.linkNote,
    incidentStart: start,
    incidentEnd: record.incidentEnd,
    hasTime: record.hasTime,
    phase: record.phase,
    verificationStatus: verification.status,
    flags: flags.join(","),
    engagement: record.engagement,
    firstReportedAt: record.publishedAt!,
    lastCheckedAt: now,
    heldForReview: held,
    reviewStatus: held ? ("PENDENTE" as const) : ("NAO_NECESSARIA" as const),
    reviewReasons: record.doubts.join("; "),
    ...placeFields(record),
    sourceUrl: record.sourceUrl,
    publicationDate: record.publishedAt!,
    retrievalDate: now,
    geographicArea: record.placeName!,
    dataPeriod: start.toISOString().slice(0, 10),
    sourceId,
  };
  await db.incident.create({ data: { ...data, contentHash: hashOf(data), updateStatus: "NEW" } });
  await logIncident(context, "NOVO", record.sourceUrl, held ? `retida para revisão${record.doubts.length ? `: ${record.doubts.join("; ")}` : ""}` : `publicada como ${verification.status.toLowerCase()}`);
  return "NEW";
}

const hashOf = (data: { category: string; tags: string; summary: string; incidentStart: Date; phase: string | null; placeName: string; precision: string; sourceLinkPublic: boolean }) =>
  sha256(JSON.stringify([data.category, data.tags, data.summary, data.incidentStart, data.phase, data.placeName, data.precision, data.sourceLinkPublic]));

async function updatePrimary(context: ApplyContext, existing: Incident, record: IncidentRecord): Promise<UpdateStatus> {
  const { db, sourceId, now } = context;
  if (existing.sourceId === CURATED_INCIDENTS && sourceId !== CURATED_INCIDENTS) {
    await db.incident.update({ where: { id: existing.id }, data: { lastCheckedAt: now } });
    return "UNCHANGED";
  }
  if (record.removed) {
    if (existing.sourceRemovedAt) return "UNCHANGED";
    await db.incident.update({ where: { id: existing.id }, data: { sourceRemovedAt: now, lastCheckedAt: now, updateStatus: "UPDATED" } });
    await logIncident(context, "ATUALIZADO", existing.key, "a publicação original foi removida");
    return "UPDATED";
  }
  // Uma publicação não oficial editada a fundo deixa de ser a mesma afirmação.
  const changed = unofficial(existing.sourceTier) && existing.textFingerprint !== "" && fingerprintSimilarity(existing.textFingerprint, record.textFingerprint) < SUBSTANTIAL_CHANGE;
  const data = {
    category: record.category,
    tags: record.tags.join(", "),
    summary: record.summary,
    incidentStart: record.incidentStart!,
    hasTime: record.hasTime,
    phase: record.phase,
    sourceLinkPublic: record.linkPublic,
    sourceLinkNote: record.linkNote,
    engagement: record.engagement,
    flags: flagsOf(record).join(","),
    ...placeFields(record),
    geographicArea: record.placeName!,
  };
  const contentHash = hashOf(data);
  if (contentHash === existing.contentHash && !changed) {
    await db.incident.update({ where: { id: existing.id }, data: { lastCheckedAt: now, retrievalDate: now, engagement: record.engagement, updateStatus: "UNCHANGED" } });
    return "UNCHANGED";
  }
  await db.incident.update({
    where: { id: existing.id },
    data: { ...data, textFingerprint: record.textFingerprint, sourceChanged: existing.sourceChanged || changed, contentHash, lastCheckedAt: now, retrievalDate: now, updateStatus: "UPDATED" },
  });
  await logIncident(context, "ATUALIZADO", existing.key, changed ? "a publicação original mudou de forma substancial" : "dados atualizados pela fonte");
  return "UPDATED";
}

/** Mesma conta, mesma agência ou cópia quase igual de outra publicação não oficial. */
function findDuplicateOf(record: IncidentRecord, incident: Incident, references: IncidentReference[]): string | null {
  const published = record.publishedAt!;
  const others = [
    { url: incident.key, independenceKey: incident.independenceKey, titleFingerprint: incident.titleFingerprint, publicationDate: incident.publicationDate, sourceTier: incident.sourceTier },
    ...references.filter((item) => !item.duplicateOfUrl).map((item) => ({ url: item.url, independenceKey: item.independenceKey, titleFingerprint: item.titleFingerprint, publicationDate: item.publicationDate, sourceTier: item.sourceTier })),
  ];
  const same = others.find((item) => item.independenceKey === record.independenceKey);
  if (same) return same.url;
  const copy = others.find((item) => isNearDuplicate(item, { titleFingerprint: record.titleFingerprint, publicationDate: published, sourceTier: record.sourceTier }));
  return copy?.url ?? null;
}

// ---------- Reconciliação: estado, revisão e arquivo ----------

export type ReviewDecision = { key: string; decision: "publicar" | "manter" | "arquivar"; note?: string };

export function readReviewDecisions(file = path.join(process.cwd(), "prisma", "data", "revisoes-ocorrencias.json")): Map<string, ReviewDecision> {
  if (!existsSync(file)) return new Map();
  const items = JSON.parse(readFileSync(file, "utf8")) as ReviewDecision[];
  return new Map(items.map((item) => [item.key, item]));
}

/**
 * Recalcula o estado de cada ocorrência recente a partir das suas fontes, atualiza a fila de revisão
 * e arquiva o que deixou de se sustentar. Corre no fim de cada recolha.
 */
export async function reconcileIncidents(
  db: PrismaClient,
  { now, runStartedAt, thresholds = thresholdsFromEnv(), decisions = readReviewDecisions() }: { now: Date; runStartedAt: Date; thresholds?: Thresholds; decisions?: Map<string, ReviewDecision> },
): Promise<{ updated: number; archived: number; pending: number }> {
  const context = { db, sourceId: "revisao", now };
  const incidents = await db.incident.findMany({
    where: { archivedAt: null, incidentStart: { gte: new Date(now.getTime() - (WINDOW_DAYS + 1) * DAY_MS) } },
    include: { references: true },
  });
  let updated = 0;
  let archived = 0;
  let pending = 0;
  for (const incident of incidents) {
    const flags = incident.flags.split(",").filter(Boolean);
    const sources = [
      { sourceTier: incident.sourceTier, agreement: "PRINCIPAL" as const, independenceKey: incident.independenceKey, removed: Boolean(incident.sourceRemovedAt) },
      ...incident.references.map((item) => ({ sourceTier: item.sourceTier, agreement: item.agreement, independenceKey: item.independenceKey, duplicate: Boolean(item.duplicateOfUrl), removed: Boolean(item.removedAt) })),
    ];
    const verification = computeVerification({ primaryTier: incident.sourceTier, phase: incident.phase, developing: flags.includes("em-desenvolvimento"), firstReportedAt: incident.firstReportedAt, now, sources, sourceChanged: incident.sourceChanged, thresholds });
    const unofficialCount = sources.filter((source) => unofficial(source.sourceTier)).length;
    const engagement = incident.engagement + incident.references.reduce((sum, item) => sum + item.engagement, 0);
    const newInformation = incident.references.some((item) => item.retrievalDate >= runStartedAt);
    const reasons = [
      ...(flags.includes("ambiguo") ? ["área ou categoria ambígua"] : []),
      ...(incident.sourceChanged ? ["a publicação original mudou"] : []),
      ...reviewReasons({ primaryTier: incident.sourceTier, category: incident.category, flags, status: verification.status, hasConflict: verification.hasConflict, firstReportedAt: incident.firstReportedAt, now, unofficialCount, engagement, newInformation, thresholds }),
    ];
    const decision = decisions.get(incident.key);
    const held = mustHold({ primaryTier: incident.sourceTier, category: incident.category, flags }, flags.includes("ambiguo")) && decision?.decision !== "publicar";
    const reviewStatus = decision ? "REVISTA" : reasons.length > 0 || held ? "PENDENTE" : "NAO_NECESSARIA";
    const archive =
      decision?.decision === "arquivar"
        ? `arquivada na revisão${decision.note ? `: ${decision.note}` : ""}`
        : archiveReason({ status: verification.status, officialContradiction: verification.officialContradiction, primaryRemoved: Boolean(incident.sourceRemovedAt), primaryTier: incident.sourceTier, firstReportedAt: incident.firstReportedAt, now, thresholds });

    const next = {
      verificationStatus: verification.status,
      hasConflict: verification.hasConflict,
      reviewStatus,
      reviewReasons: reasons.join("; "),
      heldForReview: held,
      archiveReason: archive,
    } as const;
    const same =
      next.verificationStatus === incident.verificationStatus &&
      next.hasConflict === incident.hasConflict &&
      next.reviewStatus === incident.reviewStatus &&
      next.reviewReasons === incident.reviewReasons &&
      next.heldForReview === incident.heldForReview &&
      !archive;
    if (reviewStatus === "PENDENTE") pending += 1;
    if (same) continue;
    await db.incident.update({ where: { id: incident.id }, data: { ...next, archivedAt: archive ? now : null, lastCheckedAt: now, updateStatus: "UPDATED" } });
    updated += 1;
    if (archive) {
      archived += 1;
      await logIncident(context, "ARQUIVADO", incident.key, archive);
    } else if (next.verificationStatus !== incident.verificationStatus) {
      await logIncident(context, "ATUALIZADO", incident.key, `estado: ${incident.verificationStatus.toLowerCase()} → ${next.verificationStatus.toLowerCase()}`);
    }
    if (reviewStatus === "PENDENTE" && next.reviewReasons !== incident.reviewReasons) await logIncident(context, "REVISAO", incident.key, next.reviewReasons || "retida até revisão");
  }
  return { updated, archived, pending };
}
