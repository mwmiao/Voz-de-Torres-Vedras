"use client";

import { useEffect, useRef } from "react";
import { formatDateTime } from "@/lib/format";
import { formatIncidentWhen, formatShortDate } from "@/lib/incident-format";
import { CONFLICT_NOTE, INCIDENT_CATEGORY_LABEL, SOURCE_TIER_NUMBER, type PublicIncident } from "@/lib/incidents";
import { StatusBadge } from "./IncidentCard";

export type PopupContent = {
  title: string;
  /** Localização aproximada, já em texto: «localidade», ou «concelho: a fonte não indica a freguesia». */
  location: string;
  incidents: PublicIncident[];
};

type Props = PopupContent & { selectedId: string | null; onShowInList: (id: string) => void };

const plural = (count: number) => (count === 1 ? "1 ocorrência" : `${count} ocorrências`);

/** Detalhes de um lugar no mapa. O estado de verificação aparece sempre, à cabeça ou em cada ocorrência. */
export function IncidentPopup({ title, location, incidents, selectedId, onShowInList }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = useRef<HTMLLIElement>(null);
  const status = incidents[0].verificationStatus;
  const mixed = incidents.some((incident) => incident.verificationStatus !== status);

  // Ao abrir, o foco vai para o título e a ocorrência escolhida na lista fica à vista.
  useEffect(() => {
    selected.current?.scrollIntoView({ block: "nearest" });
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="incident-popup">
      {mixed ? null : <StatusBadge status={status} prefix />}
      <h3 ref={heading} className="incident-popup__title" tabIndex={-1}>{title}</h3>
      <p className="incident-popup__meta">{plural(incidents.length)} · Localização aproximada ({location})</p>
      <ul>
        {incidents.map((incident) => (
          <li key={incident.id} ref={incident.id === selectedId ? selected : undefined} className={`incident-popup__item${incident.id === selectedId ? " is-selected" : ""}`}>
            {mixed ? <StatusBadge status={incident.verificationStatus} prefix /> : null}
            <p className="incident-popup__type">{INCIDENT_CATEGORY_LABEL[incident.category]}</p>
            <p className="incident-popup__meta">{formatIncidentWhen(incident)}</p>
            <p>{incident.summary}</p>
            {incident.hasConflict ? <p className="incident-popup__conflict">{CONFLICT_NOTE}</p> : null}
            <p className="incident-popup__meta">Fonte: {incident.sourceName} (nível {SOURCE_TIER_NUMBER[incident.sourceTier]}) · publicado a {formatShortDate(incident.publicationDate)}</p>
            {incident.author && incident.author !== incident.sourceName ? <p className="incident-popup__meta">Autoria indicada na fonte: {incident.author}</p> : null}
            {incident.references.length > 0 ? <p className="incident-popup__meta">Outras fontes: {incident.references.length}</p> : null}
            <p className="incident-popup__meta">Última verificação: {formatDateTime(new Date(incident.lastCheckedAt))}</p>
            <p className="incident-popup__actions">
              {incident.sourceUrl ? (
                <a href={incident.sourceUrl} target="_blank" rel="noopener noreferrer" className="incident-popup__source">
                  Ver fonte original<span className="sr-only"> (abre noutra janela)</span>
                </a>
              ) : (
                <span className="incident-popup__meta">{incident.sourceLinkNote ?? "Ligação não publicada."}</span>
              )}
              <button type="button" className="incident-popup__list" onClick={() => onShowInList(incident.id)}>Ver na lista</button>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
