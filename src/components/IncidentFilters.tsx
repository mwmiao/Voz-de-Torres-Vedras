"use client";

import { formatLongDay } from "@/lib/incident-format";
import { INCIDENT_CATEGORIES, INCIDENT_CATEGORY_LABEL, VERIFICATION_LABEL, VERIFICATION_STATUSES, WINDOW_DAYS } from "@/lib/incidents";

export type Filters = { area: string; tipo: string; estado: string; fonte: string; de: string; ate: string };

export const PRESETS = [{ label: "Últimas duas semanas", days: WINDOW_DAYS }, { label: "Últimos 7 dias", days: 7 }, { label: "Últimos 3 dias", days: 3 }];
/** Primeiro dia de um período rápido. «Últimas duas semanas» é a janela inteira, que inclui o 14.º dia. */
export const presetStart = (bounds: { min: string; max: string }, days: number) =>
  days === WINDOW_DAYS ? bounds.min : new Date(Date.parse(`${bounds.max}T12:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10);

type Props = {
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  freguesias: { slug: string; name: string }[];
  bounds: { min: string; max: string };
  range: { from: string; to: string };
  /** Sem JavaScript, o formulário mantém o botão de aplicar. */
  hydrated: boolean;
  changed: boolean;
  initiallyCustom: boolean;
  typeCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  sourceOptions: string[];
};

/** Filtros da área, do tipo, do estado, da fonte e do período, também sem JavaScript (formulário GET). */
export function IncidentFilters({ filters, update, freguesias, bounds, range, hydrated, changed, initiallyCustom, typeCounts, statusCounts, sourceOptions }: Props) {
  return (
    <form method="get" action="/seguranca#ocorrencias" className="rounded-lg border border-line bg-surface p-4" onSubmit={(event) => hydrated && event.preventDefault()}>
      <fieldset>
        <legend className="sr-only">Filtrar ocorrências</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium">
            A minha área
            <select name="area" value={filters.area} onChange={(event) => update({ area: event.target.value })} className="field mt-1">
              <option value="">Todo o concelho de Torres Vedras</option>
              {freguesias.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">
            Tipo de ocorrência
            <select name="tipo" value={filters.tipo} onChange={(event) => update({ tipo: event.target.value })} className="field mt-1">
              <option value="">Todos os tipos</option>
              {INCIDENT_CATEGORIES.map((category) => (
                <option key={category} value={category}>{INCIDENT_CATEGORY_LABEL[category]} ({typeCounts[category]})</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Estado de verificação
            <select name="estado" value={filters.estado} onChange={(event) => update({ estado: event.target.value })} className="field mt-1">
              <option value="">Todos</option>
              {VERIFICATION_STATUSES.map((status) => (
                <option key={status} value={status}>{VERIFICATION_LABEL[status]} ({statusCounts[status]})</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Fonte
            <select name="fonte" value={filters.fonte} onChange={(event) => update({ fonte: event.target.value })} className="field mt-1">
              <option value="">Todas as fontes</option>
              {sourceOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              {filters.fonte && !sourceOptions.includes(filters.fonte) ? <option value={filters.fonte}>{filters.fonte}</option> : null}
            </select>
          </label>
        </div>
        <div className="mt-3">
          <p id="periodo-rotulo" className="text-sm font-medium">Período <span className="font-normal text-muted">(máximo de {WINDOW_DAYS} dias)</span></p>
          <div role="group" aria-labelledby="periodo-rotulo" className="mt-1 flex flex-wrap gap-2">
            {PRESETS.map((preset) => {
              const from = presetStart(bounds, preset.days);
              const active = range.from === from && range.to === bounds.max;
              return (
                <button key={preset.days} type="button" aria-pressed={active} onClick={() => update({ de: from, ate: bounds.max })} className={`chip ${active ? "chip--active" : ""}`}>
                  {preset.label}
                </button>
              );
            })}
          </div>
          <details className="mt-2" open={initiallyCustom}>
            <summary className="cursor-pointer text-sm text-record underline">Escolher outras datas</summary>
            <div className="mt-2 grid max-w-md grid-cols-2 gap-3">
              <label className="text-sm font-medium">
                De
                <input type="date" name="de" value={filters.de} min={bounds.min} max={bounds.max} onChange={(event) => update({ de: event.target.value || bounds.min })} className="field mt-1" aria-describedby="limite-datas" />
              </label>
              <label className="text-sm font-medium">
                Até
                <input type="date" name="ate" value={filters.ate} min={bounds.min} max={bounds.max} onChange={(event) => update({ ate: event.target.value || bounds.max })} className="field mt-1" aria-describedby="limite-datas" />
              </label>
            </div>
            <p id="limite-datas" className="mt-1 text-xs text-muted">Entre {formatLongDay(bounds.min)} e {formatLongDay(bounds.max)}. Datas anteriores não estão disponíveis no mapa.</p>
          </details>
        </div>
        {!hydrated || changed ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {hydrated ? null : <button type="submit" className="btn">Aplicar filtros</button>}
            {changed ? (
              <a href="/seguranca#ocorrencias" className="btn-quiet btn-small no-underline" onClick={(event) => { if (hydrated) { event.preventDefault(); update({ area: "", tipo: "", estado: "", fonte: "", de: bounds.min, ate: bounds.max }); } }}>
                Limpar filtros
              </a>
            ) : null}
          </div>
        ) : null}
      </fieldset>
    </form>
  );
}
