import type { Metadata } from "next";
import { PageHead } from "@/components/labels";
import { db } from "@/lib/db";
import { formatDate, formatNumber, formatTime, RUN_STATUS_LABEL } from "@/lib/format";
import { SOURCE_TIER_NUMBER } from "@/lib/incidents";
import { SOURCE_CATALOG, SOURCE_STATUS_LABEL, sourceStatus, type FetchMethod } from "@/lib/source-catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Estado das fontes", description: "Origens dos dados, última atualização, estado e erros de cada recolha." };

const METHOD_LABEL: Record<FetchMethod, string> = {
  API: "API oficial",
  FICHEIRO: "Ficheiro oficial",
  SCRAPER: "Página pública",
  TRANSCRICAO: "Transcrição",
};

function frequency(hours: number): string {
  if (hours === 0) return "Sem periodicidade";
  if (hours === 24) return "Diária";
  if (hours === 168) return "Semanal";
  return `A cada ${hours} horas`;
}

export default async function EstadoDasFontesPage() {
  const [states, sources, contracts, meetings, officials, budget, decisions, modifications, incidents, references] = await Promise.all([
    db.dataSourceState.findMany(),
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
  const stateById = new Map(states.map((state) => [state.id, state]));
  const counts = new Map<string, number>();
  for (const group of [sources, contracts, meetings, officials, budget, decisions, modifications]) {
    for (const row of group) {
      if (row.dataSourceId) counts.set(row.dataSourceId, (counts.get(row.dataSourceId) ?? 0) + row._count._all);
    }
  }
  for (const row of [...incidents, ...references]) counts.set(row.sourceId, (counts.get(row.sourceId) ?? 0) + row._count._all);

  return (
    <>
      <PageHead title="Estado das fontes">
        <p>De onde vêm os dados, quando foram atualizados pela última vez e se houve problemas. Uma falha numa origem nunca apaga o que já estava publicado.</p>
      </PageHead>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <ul className="grid gap-4 lg:grid-cols-2">
          {SOURCE_CATALOG.map((source) => {
            const state = stateById.get(source.id);
            const status = state?.lastStatus ?? "NUNCA_EXECUTADA";
            return (
              <li key={source.id} className="rounded-lg border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-block rounded bg-record-soft px-1.5 py-0.5 text-xs font-semibold text-record">{METHOD_LABEL[source.method]}</span>
                  {sourceStatus(source) !== "ATIVA" ? <span className="inline-block rounded border border-dashed border-muted px-1.5 py-0.5 text-xs font-semibold text-muted">{SOURCE_STATUS_LABEL[sourceStatus(source)]}</span> : null}
                  {source.tier ? <span className="inline-block rounded border border-line px-1.5 py-0.5 text-xs font-semibold">Nível {SOURCE_TIER_NUMBER[source.tier]}</span> : null}
                </div>
                <h2 className="mt-2 font-serif text-lg font-semibold">
                  <a href={source.baseUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    {source.name}
                    <span className="sr-only"> (abre noutra janela)</span>
                  </a>
                </h2>
                <p className="mt-1 text-sm text-muted">{source.description}</p>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                  {source.coverage ? (
                    <>
                      <dt className="text-muted">Cobertura</dt>
                      <dd>{source.coverage}</dd>
                    </>
                  ) : null}
                  <dt className="text-muted">Identificador</dt>
                  <dd><code className="text-xs">{source.id}</code></dd>
                  <dt className="text-muted">Última atualização</dt>
                  <dd>{state?.lastSuccessAt ? `${formatDate(state.lastSuccessAt)}, ${formatTime(state.lastSuccessAt)}` : "Sem registo"}</dd>
                  {source.method !== "TRANSCRICAO" ? (
                    <>
                      <dt className="text-muted">Último estado</dt>
                      <dd>{source.mode === "automatic" ? RUN_STATUS_LABEL[status] : "Desativada"}</dd>
                    </>
                  ) : null}
                  <dt className="text-muted">Frequência</dt>
                  <dd>{source.mode === "automatic" ? frequency(source.frequencyHours) : "Sem recolha"}</dd>
                  <dt className="text-muted">Registos</dt>
                  <dd>{formatNumber(counts.get(source.id) ?? 0)}</dd>
                </dl>
                {source.disabledReason ? <p className="mt-3 text-sm">{source.disabledReason}</p> : null}
                {state?.lastError ? (
                  <details className="mt-3 rounded border border-dashed border-muted p-3 text-sm">
                    <summary className="cursor-pointer font-medium">Erros da última execução</summary>
                    <p className="mt-1 text-muted [overflow-wrap:anywhere]">{state.lastError}</p>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
