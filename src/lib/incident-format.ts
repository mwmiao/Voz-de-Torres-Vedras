import { formatDate, formatDateShort, formatTime } from "./format";
import type { PublicIncident } from "./incidents";

/** Data da ocorrência; a hora só aparece quando a fonte a indica. */
export function formatIncidentWhen(incident: Pick<PublicIncident, "incidentStart" | "incidentEnd" | "hasTime"> & { dateIsPublication?: boolean }): string {
  const start = new Date(incident.incidentStart);
  if (incident.dateIsPublication) return `Data não indicada na fonte (notícia de ${formatDate(start)})`;
  const text = incident.hasTime ? `${formatDate(start)}, cerca das ${formatTime(start)}` : formatDate(start);
  if (!incident.incidentEnd) return text;
  return `De ${text} a ${formatDate(new Date(incident.incidentEnd))}`;
}

export const formatShortDate = (iso: string) => formatDateShort(new Date(iso));

export const formatLongDay = (day: string) => formatDate(new Date(`${day}T12:00:00Z`));
