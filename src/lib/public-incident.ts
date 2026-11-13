import type { Incident, IncidentReference } from "@prisma/client";
import { FREGUESIAS } from "./alerts";
import { CONCELHO, CONCELHO_NAME, decodeFlags, decodeList, SOURCE_TIER_NUMBER, type PublicIncident } from "./incidents";

const NAMES = Object.fromEntries(FREGUESIAS.map((item) => [item.slug, item.name]));

type Row = Incident & { references: IncidentReference[] };

/**
 * Só campos públicos: ligações com dados pessoais ou sem arquivo ficam de fora. A fonte principal
 * mostrada é a mais fiável que corrobora; a primeira a relatar passa para «Outras fontes».
 */
export function toPublicIncident(row: Row): PublicIncident {
  const active = row.references.filter((item) => !item.removedAt && item.agreement !== "NAO_RELACIONADO");
  const stronger = active
    .filter((item) => (item.agreement === "CORROBORA" || item.agreement === "ACRESCENTA") && !item.duplicateOfUrl && item.linkPublic && SOURCE_TIER_NUMBER[item.sourceTier] < SOURCE_TIER_NUMBER[row.sourceTier])
    .sort((a, b) => SOURCE_TIER_NUMBER[a.sourceTier] - SOURCE_TIER_NUMBER[b.sourceTier] || a.publicationDate.getTime() - b.publicationDate.getTime())[0];
  const references = active
    .filter((item) => item !== stronger)
    .map((item) => ({ sourceName: item.sourceName, sourceTier: item.sourceTier, url: item.linkPublic ? item.url : null, publicationDate: item.publicationDate, agreement: item.agreement, duplicate: Boolean(item.duplicateOfUrl), firstReport: false }));
  if (stronger) {
    references.push({ sourceName: row.sourceName, sourceTier: row.sourceTier, url: row.sourceLinkPublic ? row.sourceUrl : null, publicationDate: row.publicationDate, agreement: "CORROBORA", duplicate: false, firstReport: true });
  }
  const main = stronger
    ? { sourceName: stronger.sourceName, sourceTier: stronger.sourceTier, author: null, sourceUrl: stronger.url, sourceLinkNote: null, publicationDate: stronger.publicationDate }
    : { sourceName: row.sourceName, sourceTier: row.sourceTier, author: row.author, sourceUrl: row.sourceLinkPublic ? row.sourceUrl : null, sourceLinkNote: row.sourceLinkPublic ? null : row.sourceLinkNote, publicationDate: row.publicationDate };
  return {
    id: row.id,
    category: row.category,
    tags: decodeList("tags", row.tags),
    summary: row.summary,
    ...main,
    publicationDate: main.publicationDate.toISOString(),
    verificationStatus: row.verificationStatus,
    hasConflict: row.hasConflict,
    phase: row.phase,
    lastCheckedAt: row.lastCheckedAt.toISOString(),
    references: references
      .sort((a, b) => a.publicationDate.getTime() - b.publicationDate.getTime())
      .map((item) => ({ ...item, publicationDate: item.publicationDate.toISOString() })),
    incidentStart: row.incidentStart.toISOString(),
    incidentEnd: row.incidentEnd?.toISOString() ?? null,
    hasTime: row.hasTime,
    retrievalDate: row.retrievalDate.toISOString(),
    freguesiaSlug: row.freguesiaSlug,
    freguesiaName: row.freguesiaSlug === CONCELHO ? CONCELHO_NAME : (NAMES[row.freguesiaSlug] ?? row.freguesiaSlug),
    dateIsPublication: decodeFlags(row.flags).includes("data-da-publicacao"),
    placeName: row.placeName,
    precision: row.precision,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusM: row.radiusM,
  };
}
