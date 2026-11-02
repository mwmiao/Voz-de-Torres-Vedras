import { ScrollTable } from "@/components/civic";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { frequencyLabel, SOURCE_CATALOG, SOURCE_STATUS_LABEL, sourceStatus } from "@/lib/source-catalog";

const TIER_LABEL: Record<number, string> = { 1: "1, autoridade oficial", 2: "2, comunicação social", 3: "3, conta oficial em rede social", 4: "4, fonte comunitária" };

/** Origens das ocorrências recentes, com nível, cobertura, frequência e estado. */
export async function IncidentSources() {
  const sources = SOURCE_CATALOG.filter((source) => source.group === "ocorrencias");
  const states = await db.dataSourceState.findMany({ where: { id: { in: sources.map((source) => source.id) } } });
  const byId = new Map(states.map((state) => [state.id, state]));
  return (
    <section aria-labelledby="fontes-ocorrencias" className="mb-10">
      <h2 id="fontes-ocorrencias" className="font-serif text-2xl font-semibold">Fontes das ocorrências recentes</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">
        Origens usadas no mapa da página Segurança. O nível decide o estado de verificação: só as autoridades (nível 1) confirmam. Fontes que proíbem a recolha automática ficam desativadas e só entram por registo à mão.
      </p>
      <div className="mt-3">
        <ScrollTable label="Fontes das ocorrências recentes">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <caption className="sr-only">Fontes das ocorrências recentes, com nível, área de cobertura, frequência, última atualização e estado</caption>
            <thead className="bg-paper text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2">Fonte</th>
                <th scope="col" className="px-3 py-2">Nível</th>
                <th scope="col" className="px-3 py-2">Cobertura</th>
                <th scope="col" className="px-3 py-2">Frequência</th>
                <th scope="col" className="px-3 py-2">Última atualização</th>
                <th scope="col" className="px-3 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => {
                const state = byId.get(source.id);
                const status = sourceStatus(source);
                return (
                  <tr key={source.id} className="border-t border-line align-top">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <a href={source.baseUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">{source.name}<span className="sr-only"> (abre noutra janela)</span></a>
                    </th>
                    <td className="px-3 py-2">{source.tier ? TIER_LABEL[source.tier] : "O da fonte registada"}</td>
                    <td className="px-3 py-2">{source.coverage ?? "—"}</td>
                    <td className="px-3 py-2">{frequencyLabel(source)}</td>
                    <td className="px-3 py-2">{state?.lastSuccessAt ? formatDateTime(state.lastSuccessAt) : "Sem registo"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-semibold ${status === "ATIVA" ? "border-record text-record" : "border-dashed border-muted text-muted"}`}>{SOURCE_STATUS_LABEL[status]}</span>
                      {source.disabledReason ? <p className="mt-1 text-xs text-muted">{source.disabledReason}</p> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollTable>
      </div>
    </section>
  );
}
