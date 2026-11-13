import type { VerificationStatus } from "@prisma/client";
import { formatDateTime } from "@/lib/format";
import { formatIncidentWhen, formatShortDate } from "@/lib/incident-format";
import { STATUS_CLASS, STATUS_ICON } from "@/lib/incident-status";
import {
  AGREEMENT_LABEL,
  CONFLICT_NOTE,
  INCIDENT_CATEGORY_LABEL,
  PHASE_LABEL,
  PRECISION_LABEL,
  SOURCE_TIER_LABEL,
  SOURCE_TIER_NUMBER,
  VERIFICATION_HELP,
  VERIFICATION_LABEL,
  type PublicIncident,
} from "@/lib/incidents";

export function StatusIcon({ status, className = "size-4" }: { status: VerificationStatus; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={STATUS_ICON[status]} />
    </svg>
  );
}

/** Estado sempre por extenso, com ícone e forma própria. */
export function StatusBadge({ status, prefix = false }: { status: VerificationStatus; prefix?: boolean }) {
  return (
    <span className={`status-badge ${STATUS_CLASS[status]}`}>
      <StatusIcon status={status} className="size-3.5" />
      {prefix ? "Estado: " : ""}
      {VERIFICATION_LABEL[status]}
    </span>
  );
}

export function IncidentCard({ incident, highlighted, onShowOnMap }: { incident: PublicIncident; highlighted: boolean; onShowOnMap?: () => void }) {
  const unconfirmed = incident.verificationStatus === "NAO_CONFIRMADO" || incident.verificationStatus === "EM_APURAMENTO";
  const label = `${INCIDENT_CATEGORY_LABEL[incident.category]} em ${incident.placeName}`;
  return (
    <article
      id={`ocorrencia-${incident.id}`}
      tabIndex={-1}
      aria-labelledby={`ocorrencia-${incident.id}-titulo`}
      className={`incident-card ${STATUS_CLASS[incident.verificationStatus]} rounded-lg border bg-surface p-3 ${highlighted ? "border-record ring-2 ring-record" : "border-line"}`}
    >
      <StatusBadge status={incident.verificationStatus} prefix />
      <h4 id={`ocorrencia-${incident.id}-titulo`} className="mt-1.5 font-semibold">
        {INCIDENT_CATEGORY_LABEL[incident.category]}
        <span className="sr-only">, {VERIFICATION_LABEL[incident.verificationStatus]}</span>
      </h4>
      <p className="mt-1 text-sm">{incident.summary}</p>
      {unconfirmed ? <p className="mt-1 text-xs text-muted">{VERIFICATION_HELP[incident.verificationStatus]}</p> : null}
      {incident.hasConflict ? (
        <p className="mt-2 flex gap-1.5 rounded border border-dashed border-muted px-2 py-1 text-sm">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 2l6.5 11.5h-13zM8 6.5v3.5M8 12v.3" /></svg>
          {CONFLICT_NOTE}
        </p>
      ) : null}
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        <dt className="text-muted">Quando</dt>
        <dd>
          {formatIncidentWhen(incident)}
          {incident.phase ? <span className="text-muted"> (segundo a fonte, {PHASE_LABEL[incident.phase]})</span> : null}
        </dd>
        <dt className="text-muted">Onde</dt>
        <dd>
          Localização aproximada: {incident.placeName}
          {incident.precision !== "FREGUESIA" && incident.precision !== "CONCELHO" ? `, ${incident.freguesiaName}` : ""}{" "}
          <span className="text-muted">({incident.precision === "CONCELHO" ? "a fonte não indica a freguesia" : PRECISION_LABEL[incident.precision].toLowerCase()})</span>
        </dd>
        <dt className="text-muted">Fonte</dt>
        <dd>
          Fonte: {incident.sourceName} <span className="text-muted">(nível {SOURCE_TIER_NUMBER[incident.sourceTier]}: {SOURCE_TIER_LABEL[incident.sourceTier].toLowerCase()})</span>, publicado a {formatShortDate(incident.publicationDate)}
          {incident.author ? <span className="block text-muted">Autoria indicada na fonte: {incident.author}</span> : null}
        </dd>
        <dt className="text-muted">Verificado</dt>
        <dd>Última verificação: {formatDateTime(new Date(incident.lastCheckedAt))}</dd>
      </dl>
      {incident.tags.length > 0 ? <p className="mt-1 text-xs text-muted">Também: {incident.tags.join(", ")}</p> : null}
      {incident.references.length > 0 ? (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-record underline">Outras fontes ({incident.references.length})</summary>
          <ul className="mt-1 space-y-1">
            {incident.references.map((reference, index) => (
              <li key={`${reference.sourceName}-${index}`}>
                <span className="font-medium">{reference.firstReport ? "Primeiro relato" : AGREEMENT_LABEL[reference.agreement]}</span>
                {reference.duplicate ? <span className="text-muted"> (repete outra publicação, não conta como fonte independente)</span> : null}: {" "}
                {reference.url ? (
                  <a href={reference.url} target="_blank" rel="noopener noreferrer" className="underline">{reference.sourceName}<span className="sr-only"> (abre noutra janela)</span></a>
                ) : (
                  <span>{reference.sourceName} <span className="text-muted">(ligação não publicada)</span></span>
                )}{" "}
                <span className="text-muted">· nível {SOURCE_TIER_NUMBER[reference.sourceTier]} · {formatShortDate(reference.publicationDate)}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {incident.sourceUrl ? (
          <a href={incident.sourceUrl} target="_blank" rel="noopener noreferrer" className="btn-quiet btn-small no-underline">
            Ver fonte original<span className="sr-only">: {label} (abre noutra janela)</span>
          </a>
        ) : (
          <p className="text-xs text-muted">{incident.sourceLinkNote ?? "Ligação não publicada."}</p>
        )}
        {onShowOnMap ? (
          <button type="button" onClick={onShowOnMap} className="btn-quiet btn-small">
            Mostrar no mapa<span className="sr-only">: {label}</span>
          </button>
        ) : null}
      </div>
    </article>
  );
}
