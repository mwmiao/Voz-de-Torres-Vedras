import type { Source } from "@prisma/client";
import { formatDate } from "@/lib/format";
import { isVerified, SOURCE_TYPE_LABEL } from "@/lib/sources";

export function OfficialBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-record px-1.5 py-0.5 text-xs font-semibold text-white">
      <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M2 6.5 5 9.5 10 3" />
      </svg>
      Fonte oficial
    </span>
  );
}

export function UnverifiedBadge() {
  return <span className="inline-block rounded border border-dashed border-muted px-1.5 py-0.5 text-xs font-semibold text-muted">Não verificado</span>;
}

type ChipSource = Pick<Source, "id" | "title" | "url" | "type" | "official">;

/** Ligações curtas para linhas de tabela: "Ata", "Vídeo", "Edital". */
export function SourceChips({ sources }: { sources: ChipSource[] }) {
  if (sources.length === 0) return <UnverifiedBadge />;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {sources.map((source) => (
        <li key={source.id}>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={source.title}
            className="inline-block rounded border border-record/40 bg-record-soft px-2 py-1 text-xs font-semibold text-record underline hover:bg-record hover:text-white"
          >
            {SOURCE_TYPE_LABEL[source.type]}
            <span className="sr-only">: {source.title} (abre noutra janela)</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/** O recibo completo de uma fonte. */
export function Receipt({ source }: { source: Source }) {
  return (
    <article className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        {source.official ? <OfficialBadge /> : <UnverifiedBadge />}
        <span className="text-xs font-semibold text-muted">{SOURCE_TYPE_LABEL[source.type]}</span>
      </div>
      <h3 className="mt-2 font-medium">
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
          {source.title}
          <span className="sr-only"> (abre noutra janela)</span>
        </a>
      </h3>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm text-muted">
        <dt>Entidade</dt>
        <dd>{source.name}</dd>
        <dt>Publicação</dt>
        <dd>{source.publishedAt ? formatDate(source.publishedAt) : "Data não indicada na fonte"}</dd>
        <dt>Consulta</dt>
        <dd>{formatDate(source.retrievedAt)}</dd>
      </dl>
      {source.excerpt ? <blockquote className="mt-2 border-l-2 border-line pl-3 text-sm">“{source.excerpt}”</blockquote> : null}
    </article>
  );
}

type ClaimLike = { id: string; text: string; sources: ChipSource[] };

/** Só com fonte oficial é que uma afirmação aparece como facto. */
export function Claims({ claims }: { claims: ClaimLike[] }) {
  const verified = claims.filter((claim) => isVerified(claim.sources));
  const unverified = claims.filter((claim) => !isVerified(claim.sources));
  return (
    <>
      {verified.length > 0 ? (
        <ul className="space-y-3">
          {verified.map((claim) => (
            <li key={claim.id}>
              <p>{claim.text}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <OfficialBadge />
                <SourceChips sources={claim.sources.filter((source) => source.official)} />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {unverified.length > 0 ? (
        <details className="mt-3 rounded border border-dashed border-muted p-3 text-sm text-muted">
          <summary className="cursor-pointer font-medium">Por verificar: não são factos ({unverified.length})</summary>
          <ul className="mt-2 space-y-2">
            {unverified.map((claim) => (
              <li key={claim.id}>
                <UnverifiedBadge /> <span className="italic">{claim.text}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
