"use client";

import type { VerificationStatus } from "@prisma/client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { formatIncidentWhen, formatLongDay, formatShortDate } from "@/lib/incident-format";
import { STATUS_CLASS, STATUS_ICON } from "@/lib/incident-status";
import {
  AGREEMENT_LABEL,
  CONFLICT_NOTE,
  EMPTY_MESSAGE,
  filterIncidents,
  sourceNamesOf,
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABEL,
  LOCATION_DISCLAIMER,
  PHASE_LABEL,
  PRECISION_LABEL,
  SOURCE_TIER_LABEL,
  SOURCE_TIER_NUMBER,
  VERIFICATION_HELP,
  VERIFICATION_LABEL,
  VERIFICATION_STATUSES,
  WINDOW_DAYS,
  type PublicIncident,
} from "@/lib/incidents";
import { formatDateTime } from "@/lib/format";

const IncidentMap = dynamic(() => import("./IncidentMap"), {
  ssr: false,
  loading: () => <MapMessage>A carregar o mapa…</MapMessage>,
});

export type Filters = { area: string; tipo: string; estado: string; fonte: string; de: string; ate: string };

type Props = {
  incidents: PublicIncident[];
  freguesias: { slug: string; name: string }[];
  initial: Filters;
  bounds: { min: string; max: string };
};

function MapMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[58vh] min-h-[320px] items-center justify-center rounded-lg border border-line bg-paper p-6 text-center text-sm text-muted md:h-[520px]" role="status">
      {children}
    </div>
  );
}

const subscribeNothing = () => () => {};
const PRESETS = [{ label: "Últimas duas semanas", days: WINDOW_DAYS }, { label: "Últimos 7 dias", days: 7 }, { label: "Últimos 3 dias", days: 3 }];
const presetStart = (max: string, days: number) => new Date(Date.parse(`${max}T12:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10);
const plural = (count: number) => (count === 1 ? "1 ocorrência visível" : `${count} ocorrências visíveis`);

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

export function IncidentExplorer({ incidents, freguesias, initial, bounds }: Props) {
  const [filters, setFilters] = useState<Filters>(initial);
  // Falso no HTML do servidor: sem JavaScript, o formulário mantém o botão de aplicar.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [mapFailed, setMapFailed] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ id: string; seq: number } | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  // Datas que não correspondem a um período rápido abrem logo a escolha de datas.
  const [initiallyCustom] = useState(() => initial.ate !== bounds.max || !PRESETS.some((preset) => presetStart(bounds.max, preset.days) === initial.de));

  // O endereço acompanha os filtros, para se poder partilhar ou voltar atrás.
  useEffect(() => {
    if (!hydrated) return;
    const url = new URL(window.location.href);
    const set = (key: string, value: string, fallback: string) => (value && value !== fallback ? url.searchParams.set(key, value) : url.searchParams.delete(key));
    set("area", filters.area, "");
    set("tipo", filters.tipo, "");
    set("estado", filters.estado, "");
    set("fonte", filters.fonte, "");
    set("de", filters.de, bounds.min);
    set("ate", filters.ate, bounds.max);
    window.history.replaceState(null, "", url);
  }, [filters, hydrated, bounds]);

  const range = useMemo(() => {
    const from = filters.de < bounds.min ? bounds.min : filters.de;
    const to = filters.ate > bounds.max ? bounds.max : filters.ate;
    return from <= to ? { from, to } : { from: to, to: from };
  }, [filters.de, filters.ate, bounds]);

  // As contagens de cada filtro consideram os outros filtros, mas não o próprio.
  const base = useMemo(() => filterIncidents(incidents, { area: filters.area, range }), [incidents, filters.area, range]);
  const visible = useMemo(() => filterIncidents(base, { tipo: filters.tipo, estado: filters.estado, fonte: filters.fonte }), [base, filters.tipo, filters.estado, filters.fonte]);
  // Fontes presentes nas ocorrências das duas semanas, pela ordem do nome.
  const sourceOptions = useMemo(() => [...new Set(incidents.flatMap(sourceNamesOf))].sort((a, b) => a.localeCompare(b, "pt")), [incidents]);
  const typeCounts = useMemo(() => {
    const pool = filterIncidents(base, { estado: filters.estado, fonte: filters.fonte });
    return Object.fromEntries(INCIDENT_CATEGORIES.map((category) => [category, pool.filter((item) => item.category === category).length]));
  }, [base, filters.estado, filters.fonte]);
  const statusCounts = useMemo(() => {
    const pool = filterIncidents(base, { tipo: filters.tipo, fonte: filters.fonte });
    return Object.fromEntries(VERIFICATION_STATUSES.map((status) => [status, pool.filter((item) => item.verificationStatus === status).length]));
  }, [base, filters.tipo, filters.fonte]);

  const update = (patch: Partial<Filters>) => {
    setHighlighted(null);
    setFilters((current) => ({ ...current, ...patch }));
  };
  const selectedName = freguesias.find((item) => item.slug === filters.area)?.name;
  const areaName = selectedName ? `Freguesia de ${selectedName}` : "Todo o concelho";
  const changed = filters.area || filters.tipo || filters.estado || filters.fonte || range.from !== bounds.min || range.to !== bounds.max;
  const fullWindow = range.from === bounds.min && range.to === bounds.max;
  const unconfirmedVisible = visible.filter((item) => item.verificationStatus === "NAO_CONFIRMADO" || item.verificationStatus === "EM_APURAMENTO").length;

  const showInList = (id: string) => {
    setHighlighted(id);
    const card = document.getElementById(`ocorrencia-${id}`);
    card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    card?.focus({ preventScroll: true });
  };

  const showOnMap = (id: string) => {
    setHighlighted(id);
    setFocusRequest((current) => ({ id, seq: (current?.seq ?? 0) + 1 }));
    // «start» respeita o espaço do cabeçalho fixo (scroll-padding-top).
    document.getElementById("mapa-ocorrencias")?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div className="space-y-4">
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
                const from = presetStart(bounds.max, preset.days);
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

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-record-soft px-4 py-3">
        <div role="status" aria-live="polite">
          <p className="font-semibold">
            {plural(visible.length)}
            {unconfirmedVisible > 0 ? <span className="font-normal">, das quais {unconfirmedVisible} sem confirmação</span> : null}
          </p>
          <p className="text-sm">
            {areaName} · {filters.tipo ? INCIDENT_CATEGORY_LABEL[filters.tipo as keyof typeof INCIDENT_CATEGORY_LABEL] : "todos os tipos"} ·{" "}
            {filters.estado ? VERIFICATION_LABEL[filters.estado as VerificationStatus] : "todos os estados"} ·{" "}
            {filters.fonte ? `fonte: ${filters.fonte}` : "todas as fontes"} ·{" "}
            {range.from === range.to ? formatLongDay(range.from) : `${formatLongDay(range.from)} a ${formatLongDay(range.to)}`}
          </p>
        </div>
        {visible.length > 0 ? <a href="#lista-ocorrencias" className="text-sm underline">Saltar o mapa e ver a lista</a> : null}
      </div>

      <MapLegend />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div id="mapa-ocorrencias" className="space-y-2">
          <p className="flex gap-2 text-sm">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-0.5 size-4 shrink-0 text-record" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="8" cy="8" r="6.5" /><path d="M8 7.5v4M8 4.8v.2" /></svg>
            <span>{LOCATION_DISCLAIMER}</span>
          </p>
          <p id="mapa-instrucoes" className="sr-only">
            Mapa interativo. Use a tecla Tab para percorrer os marcadores e Enter para abrir os detalhes. Cada marcador indica o estado de verificação. A lista de ocorrências, a seguir ao mapa, tem a mesma informação.
          </p>
          {mapFailed ? (
            <MapMessage>Não foi possível carregar o mapa. A lista de ocorrências continua disponível.</MapMessage>
          ) : (
            <IncidentMap
              incidents={visible}
              freguesia={filters.area}
              focusRequest={focusRequest}
              onShowInList={showInList}
              onFreguesia={(slug) => update({ area: slug === filters.area ? "" : slug })}
              onError={() => setMapFailed(true)}
            />
          )}
        </div>

        <section aria-labelledby="lista-ocorrencias" className="min-w-0">
          <h3 id="lista-ocorrencias" className="text-sm font-semibold">Lista de ocorrências</h3>
          {visible.length === 0 ? (
            <div className="mt-2 rounded-lg border border-line bg-surface p-4">
              <p className="font-medium">{filters.tipo || filters.estado || filters.fonte || !fullWindow ? "Nenhuma ocorrência corresponde aos filtros escolhidos." : EMPTY_MESSAGE}</p>
              {filters.tipo || filters.estado || filters.fonte || !fullWindow ? <p className="mt-1 text-sm text-muted">Experimente outro tipo, outro estado ou as últimas duas semanas completas.</p> : null}
            </div>
          ) : (
            <ol className="mt-2 space-y-3 lg:max-h-[488px] lg:overflow-y-auto lg:pr-1">
              {visible.map((incident) => (
                <li key={incident.id}>
                  <IncidentCard incident={incident} highlighted={highlighted === incident.id} onShowOnMap={mapFailed ? undefined : () => showOnMap(incident.id)} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

function IncidentCard({ incident, highlighted, onShowOnMap }: { incident: PublicIncident; highlighted: boolean; onShowOnMap?: () => void }) {
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
          {incident.precision !== "FREGUESIA" ? `, ${incident.freguesiaName}` : ""}{" "}
          <span className="text-muted">({PRECISION_LABEL[incident.precision].toLowerCase()})</span>
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

/** Legenda visível: estados, localização aproximada e limite de 14 dias. */
function MapLegend() {
  return (
    <section aria-labelledby="legenda-ocorrencias" className="rounded-lg border border-line bg-surface p-3">
      <h3 id="legenda-ocorrencias" className="text-sm font-semibold">Legenda</h3>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {VERIFICATION_STATUSES.map((status) => (
          <li key={status} className="flex items-center gap-2">
            <span aria-hidden="true" className={`incident-marker incident-marker--legend ${STATUS_CLASS[status]}`}>
              <svg viewBox="0 0 16 16" className="status-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={STATUS_ICON[status]} /></svg>
            </span>
            <span className="font-semibold">{VERIFICATION_LABEL[status]}</span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block size-6 shrink-0 rounded-full border-2 border-dashed border-record bg-record/10" />
          <span className="font-semibold">Localização aproximada</span>
        </li>
        <li className="flex items-center gap-2">
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-6 shrink-0 text-record" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6.5h12M5 1.5v3M11 1.5v3" /></svg>
          <span className="font-semibold">Limite de {WINDOW_DAYS} dias</span>
        </li>
      </ul>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-record underline">O que significa cada estado</summary>
        <dl className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-[auto_1fr]">
          {VERIFICATION_STATUSES.map((status) => (
            <div key={status} className="contents">
              <dt className="font-semibold">{VERIFICATION_LABEL[status]}</dt>
              <dd className="text-muted">{VERIFICATION_HELP[status]}</dd>
            </div>
          ))}
          <dt className="font-semibold">Localização aproximada</dt>
          <dd className="text-muted">Círculo tracejado em volta da localidade, ou a freguesia tracejada quando só a freguesia é conhecida. Nunca uma morada.</dd>
          <dt className="font-semibold">Limite de {WINDOW_DAYS} dias</dt>
          <dd className="text-muted">Só aparecem ocorrências das duas últimas semanas, pela data da ocorrência.</dd>
        </dl>
      </details>
    </section>
  );
}
