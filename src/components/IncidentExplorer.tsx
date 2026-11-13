"use client";

import type { VerificationStatus } from "@prisma/client";
import "./incidents.css";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { formatLongDay } from "@/lib/incident-format";
import { EMPTY_MESSAGE, filterIncidents, INCIDENT_CATEGORIES, INCIDENT_CATEGORY_LABEL, LOCATION_DISCLAIMER, sourceNamesOf, VERIFICATION_LABEL, VERIFICATION_STATUSES, type PublicIncident } from "@/lib/incidents";
import { IncidentCard } from "./IncidentCard";
import { IncidentFilters, PRESETS, presetStart, type Filters } from "./IncidentFilters";
import { MapLegend } from "./MapLegend";

const IncidentMap = dynamic(() => import("./IncidentMap"), {
  ssr: false,
  loading: () => <MapMessage>A carregar o mapa…</MapMessage>,
});

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
const plural = (count: number) => (count === 1 ? "1 ocorrência visível" : `${count} ocorrências visíveis`);

export function IncidentExplorer({ incidents, freguesias, initial, bounds }: Props) {
  const [filters, setFilters] = useState<Filters>(initial);
  // Falso no HTML do servidor: sem JavaScript, o formulário mantém o botão de aplicar.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [mapFailed, setMapFailed] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ id: string; seq: number } | null>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  // Datas que não correspondem a um período rápido abrem logo a escolha de datas.
  const [initiallyCustom] = useState(() => initial.ate !== bounds.max || !PRESETS.some((preset) => presetStart(bounds, preset.days) === initial.de));

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
  // Ocorrências só com o concelho não pertencem a nenhuma freguesia: o filtro de área deixa-as de fora.
  const concelhoOnly = useMemo(
    () => (filters.area ? filterIncidents(incidents, { range, tipo: filters.tipo, estado: filters.estado, fonte: filters.fonte }).filter((item) => item.precision === "CONCELHO").length : 0),
    [incidents, range, filters.area, filters.tipo, filters.estado, filters.fonte],
  );
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
      <IncidentFilters
        filters={filters}
        update={update}
        freguesias={freguesias}
        bounds={bounds}
        range={range}
        hydrated={hydrated}
        changed={Boolean(changed)}
        initiallyCustom={initiallyCustom}
        typeCounts={typeCounts}
        statusCounts={statusCounts}
        sourceOptions={sourceOptions}
      />

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
        {concelhoOnly > 0 ? (
          <p className="w-full text-sm">
            {concelhoOnly === 1 ? "1 ocorrência não tem freguesia indicada na fonte e só aparece" : `${concelhoOnly} ocorrências não têm freguesia indicada na fonte e só aparecem`} com «Todo o concelho».{" "}
            <button type="button" className="underline" onClick={() => update({ area: "" })}>Ver todo o concelho</button>
          </p>
        ) : null}
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
