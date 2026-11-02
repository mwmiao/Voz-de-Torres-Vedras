"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";
import type { VerificationStatus } from "@prisma/client";
import { formatDateTime } from "@/lib/format";
import { formatIncidentWhen, formatShortDate } from "@/lib/incident-format";
import { STATUS_CLASS, statusSvg } from "@/lib/incident-status";
import {
  BOUNDARIES_URL,
  CONCELHO_POINT,
  CONFLICT_NOTE,
  INCIDENT_CATEGORY_LABEL,
  PRECISION_LABEL,
  SOURCE_TIER_NUMBER,
  VERIFICATION_LABEL,
  VERIFICATION_STATUSES,
  type PublicIncident,
} from "@/lib/incidents";

type Props = {
  incidents: PublicIncident[];
  freguesia: string;
  /** Pedido da lista para mostrar uma ocorrência; `seq` permite repetir o mesmo pedido. */
  focusRequest: { id: string; seq: number } | null;
  onShowInList: (id: string) => void;
  onFreguesia: (slug: string) => void;
  onError: () => void;
};

/** Marcadores mais próximos do que isto, em píxeis, juntam-se num só. */
const CLUSTER_PX = 46;
const BOUNDS: [L.LatLngTuple, L.LatLngTuple] = [[38.99, -9.44], [39.23, -9.11]];
const INK = "#1b4965";

type Group = { key: string; latlng: L.LatLng; incidents: PublicIncident[] };
/** Um lugar pode ter vários estados: cada estado tem o seu marcador, lado a lado. */
type Place = { key: string; latlng: L.LatLng; byStatus: Group[]; count: number };

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
const plural = (count: number) => (count === 1 ? "1 ocorrência" : `${count} ocorrências`);
const placeKey = (incident: Pick<PublicIncident, "latitude" | "longitude">) => `${incident.latitude},${incident.longitude}`;
const groupKey = (incident: Pick<PublicIncident, "latitude" | "longitude" | "verificationStatus">) => `${placeKey(incident)}|${incident.verificationStatus}`;

const STATUS_COUNT: Record<VerificationStatus, [string, string]> = {
  CONFIRMADO: ["confirmada", "confirmadas"],
  REPORTADO: ["reportada", "reportadas"],
  NAO_CONFIRMADO: ["não confirmada", "não confirmadas"],
  EM_APURAMENTO: ["em apuramento", "em apuramento"],
};

/** «2 confirmadas, 1 não confirmada»: o estado também é dito por extenso aos leitores de ecrã. */
export function statusBreakdown(incidents: Pick<PublicIncident, "verificationStatus">[]): string {
  return VERIFICATION_STATUSES.flatMap((status) => {
    const count = incidents.filter((item) => item.verificationStatus === status).length;
    return count ? [`${count} ${STATUS_COUNT[status][count === 1 ? 0 : 1]}`] : [];
  }).join(", ");
}

function groupByPlace(incidents: PublicIncident[]): Place[] {
  const places = new Map<string, Place>();
  // Só o concelho: sem marcador, para não sugerir um lugar. Aparecem no painel «Concelho inteiro».
  for (const incident of incidents.filter((item) => item.precision !== "CONCELHO")) {
    const place = places.get(placeKey(incident)) ?? { key: placeKey(incident), latlng: L.latLng(incident.latitude, incident.longitude), byStatus: [], count: 0 };
    let group = place.byStatus.find((item) => item.key === groupKey(incident));
    if (!group) {
      group = { key: groupKey(incident), latlng: place.latlng, incidents: [] };
      place.byStatus.push(group);
    }
    group.incidents.push(incident);
    place.count += 1;
    places.set(place.key, place);
  }
  for (const place of places.values()) place.byStatus.sort((a, b) => VERIFICATION_STATUSES.indexOf(a.incidents[0].verificationStatus) - VERIFICATION_STATUSES.indexOf(b.incidents[0].verificationStatus));
  return [...places.values()];
}

/** Agrupa, ao nível de zoom atual, os lugares cujos marcadores se sobreporiam. */
function cluster(map: L.Map, places: Place[]): Place[][] {
  const clusters: { point: L.Point; members: Place[] }[] = [];
  for (const place of places) {
    const point = map.latLngToLayerPoint(place.latlng);
    const width = CLUSTER_PX * Math.max(1, place.byStatus.length);
    const near = clusters.find((item) => item.point.distanceTo(point) < width);
    if (near) near.members.push(place);
    else clusters.push({ point, members: [place] });
  }
  return clusters.map((item) => item.members);
}

function popupHtml(group: Group, selectedId: string | null): string {
  const first = group.incidents[0];
  const status = first.verificationStatus;
  const mixed = group.incidents.some((incident) => incident.verificationStatus !== status);
  const concelho = first.precision === "CONCELHO";
  const items = group.incidents
    .map((incident) => `
      <li class="incident-popup__item${incident.id === selectedId ? " is-selected" : ""}">
        ${mixed ? `<p class="status-badge ${STATUS_CLASS[incident.verificationStatus]}">${statusSvg(incident.verificationStatus)}Estado: ${escape(VERIFICATION_LABEL[incident.verificationStatus])}</p>` : ""}
        <p class="incident-popup__type">${escape(INCIDENT_CATEGORY_LABEL[incident.category])}</p>
        <p class="incident-popup__meta">${escape(formatIncidentWhen(incident))}</p>
        <p>${escape(incident.summary)}</p>
        ${incident.hasConflict ? `<p class="incident-popup__conflict">${escape(CONFLICT_NOTE)}</p>` : ""}
        <p class="incident-popup__meta">Fonte: ${escape(incident.sourceName)} (nível ${SOURCE_TIER_NUMBER[incident.sourceTier]}) · publicado a ${escape(formatShortDate(incident.publicationDate))}</p>
        ${incident.author && incident.author !== incident.sourceName ? `<p class="incident-popup__meta">Autoria indicada na fonte: ${escape(incident.author)}</p>` : ""}
        ${incident.references.length ? `<p class="incident-popup__meta">Outras fontes: ${incident.references.length}</p>` : ""}
        <p class="incident-popup__meta">Última verificação: ${escape(formatDateTime(new Date(incident.lastCheckedAt)))}</p>
        <p class="incident-popup__actions">
          ${incident.sourceUrl ? `<a href="${escape(incident.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="incident-popup__source">Ver fonte original<span class="sr-only"> (abre noutra janela)</span></a>` : `<span class="incident-popup__meta">${escape(incident.sourceLinkNote ?? "Ligação não publicada.")}</span>`}
          <button type="button" class="incident-popup__list" data-incident="${escape(incident.id)}">Ver na lista</button>
        </p>
      </li>`)
    .join("");
  return `
    <div class="incident-popup">
      ${mixed ? "" : `<p class="status-badge ${STATUS_CLASS[status]}">${statusSvg(status)}Estado: ${escape(VERIFICATION_LABEL[status])}</p>`}
      <h3 class="incident-popup__title" tabindex="-1">${escape(first.placeName)}</h3>
      <p class="incident-popup__meta">${escape(plural(group.incidents.length))} · ${concelho ? "Localização aproximada (concelho): a fonte não indica a freguesia" : `Localização aproximada (${escape(PRECISION_LABEL[first.precision].toLowerCase())})`}</p>
      <ul>${items}</ul>
    </div>`;
}

function markerIcon(status: VerificationStatus | null, count: number, offsetX = 0): L.DivIcon {
  const size = 36;
  const badge = count > 1 || status === null ? `<span class="incident-marker__count">${count}</span>` : "";
  return L.divIcon({
    className: `incident-marker ${status ? STATUS_CLASS[status] : "incident-marker--cluster"}`,
    html: `<span aria-hidden="true">${status ? statusSvg(status) : ""}${badge}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2 - offsetX, size / 2],
    popupAnchor: [offsetX, -size / 2],
  });
}

export default function IncidentMap({ incidents, freguesia, focusRequest, onShowInList, onFreguesia, onError }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const boundaries = useRef<L.GeoJSON | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const zones = useRef<L.LayerGroup | null>(null);
  const markerByGroup = useRef(new Map<string, L.Marker>());
  const concelhoButton = useRef<HTMLButtonElement | null>(null);
  const concelhoOpen = useRef(false);
  const callbacks = useRef({ onShowInList, onFreguesia, onError });
  const state = useRef({ incidents, freguesia, selectedId: focusRequest?.id ?? null });
  callbacks.current = { onShowInList, onFreguesia, onError };
  state.current = { incidents, freguesia, selectedId: focusRequest?.id ?? null };

  // O mapa é criado uma vez; os dados mudam depois por camadas.
  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = L.map(container.current, {
      zoomControl: false,
      // A roda do rato e a página partilham o deslocamento: o zoom faz-se nos botões ou com dois dedos.
      scrollWheelZoom: false,
      maxBounds: L.latLngBounds(BOUNDS).pad(0.5),
      minZoom: 10,
      zoomSnap: 0.5,
      maxZoom: 15,
    });
    L.control.zoom({ position: "topright", zoomInTitle: "Aproximar", zoomOutTitle: "Afastar" }).addTo(instance);
    instance.attributionControl.setPrefix(false);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> · Limites: CAOP 2025 (DGT)',
    }).addTo(instance);
    instance.fitBounds(BOUNDS);
    zones.current = L.layerGroup().addTo(instance);
    // Painel para as ocorrências que a fonte só situa no concelho: realça o concelho inteiro.
    const control = new L.Control({ position: "bottomleft" });
    control.onAdd = () => {
      const button = L.DomUtil.create("button", "incident-concelho");
      button.type = "button";
      button.hidden = true;
      L.DomEvent.disableClickPropagation(button);
      L.DomEvent.on(button, "click", () => openConcelho());
      concelhoButton.current = button;
      return button;
    };
    control.addTo(instance);
    markers.current = L.layerGroup().addTo(instance);
    map.current = instance;

    // Os controlos do Leaflet são ligações sem nome em português: corrige-se aqui.
    container.current.querySelectorAll<HTMLAnchorElement>(".leaflet-control-zoom a").forEach((link) => {
      link.setAttribute("aria-label", link.title);
      link.setAttribute("role", "button");
    });

    // Um mapa desmontado antes de os limites chegarem não deve mostrar erro.
    let alive = true;
    fetch(BOUNDARIES_URL)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data: GeoJSON.FeatureCollection) => {
        if (!alive) return;
        boundaries.current = L.geoJSON(data, {
          style: () => ({ color: INK, weight: 1, opacity: 0.6, fillOpacity: 0.04 }),
          onEachFeature: (feature, layer) => {
            layer.bindTooltip(String(feature.properties?.name ?? ""), { sticky: true, direction: "top" });
            layer.on("click", () => callbacks.current.onFreguesia(String(feature.properties?.slug ?? "")));
          },
        }).addTo(instance);
        boundaries.current.bringToBack();
        styleBoundaries();
        fitArea();
      })
      .catch(() => {
        if (alive) callbacks.current.onError();
      });

    instance.on("zoomend", () => drawMarkers());
    instance.on("popupclose", () => {
      if (!concelhoOpen.current) return;
      concelhoOpen.current = false;
      styleBoundaries();
      concelhoButton.current?.focus({ preventScroll: true });
    });
    instance.on("popupopen", (event) => {
      const element = event.popup.getElement();
      element?.querySelectorAll<HTMLButtonElement>("[data-incident]").forEach((button) => {
        button.addEventListener("click", () => {
          instance.closePopup();
          callbacks.current.onShowInList(button.dataset.incident!);
        });
      });
      const close = element?.querySelector<HTMLAnchorElement>(".leaflet-popup-close-button");
      close?.setAttribute("aria-label", "Fechar detalhes");
      close?.setAttribute("title", "Fechar detalhes");
      element?.querySelector<HTMLElement>(".is-selected")?.scrollIntoView({ block: "nearest" });
      element?.querySelector<HTMLElement>(".incident-popup__title")?.focus({ preventScroll: true });
    });
    return () => {
      alive = false;
      instance.remove();
      map.current = null;
      boundaries.current = null;
    };
    // As funções de desenho leem sempre o estado atual através de refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function styleBoundaries() {
    const selected = state.current.freguesia;
    const withIncidents = new Set(state.current.incidents.filter((item) => item.precision === "FREGUESIA").map((item) => item.freguesiaSlug));
    boundaries.current?.eachLayer((layer) => {
      const slug = (layer as L.GeoJSON & { feature: GeoJSON.Feature }).feature.properties?.slug as string;
      const path = layer as L.Path;
      if (selected && slug === selected) path.setStyle({ weight: 3, opacity: 1, fillOpacity: 0.12, fillColor: INK, dashArray: undefined });
      else if (selected) path.setStyle({ weight: 1, opacity: 0.35, fillOpacity: 0.18, fillColor: "#6b7280", dashArray: undefined });
      // Ocorrência só com a freguesia: a área inteira fica assinalada, com tracejado.
      else if (withIncidents.has(slug)) path.setStyle({ weight: 1.5, opacity: 0.8, fillOpacity: 0.1, fillColor: INK, dashArray: "4 4" });
      else path.setStyle({ weight: 1, opacity: 0.6, fillOpacity: 0.04, fillColor: INK, dashArray: undefined });
    });
  }

  function concelhoIncidents() {
    return state.current.incidents.filter((item) => item.precision === "CONCELHO");
  }

  function openConcelho() {
    const instance = map.current;
    const items = concelhoIncidents();
    if (!instance || items.length === 0) return;
    instance.fitBounds(boundaries.current?.getBounds() ?? BOUNDS, { padding: [12, 12] });
    boundaries.current?.eachLayer((layer) => (layer as L.Path).setStyle({ weight: 2.5, opacity: 1, dashArray: "6 4", fillOpacity: 0.12, fillColor: INK }));
    L.popup({ maxWidth: 320, minWidth: 240, autoPanPadding: L.point(24, 24) })
      .setLatLng(CONCELHO_POINT)
      .setContent(popupHtml({ key: "concelho", latlng: L.latLng(CONCELHO_POINT), incidents: items }, state.current.selectedId))
      .openOn(instance);
    concelhoOpen.current = true;
  }

  function drawConcelhoButton() {
    const button = concelhoButton.current;
    if (!button) return;
    const items = concelhoIncidents();
    button.hidden = items.length === 0;
    const text = `Concelho inteiro: ${plural(items.length)} sem freguesia indicada`;
    button.innerHTML = `<span aria-hidden="true" class="incident-concelho__count">${items.length}</span> ${escape(text)}`;
    button.setAttribute("aria-label", `${text} (${statusBreakdown(items)}). Abrir detalhes`);
  }

  function drawMarkers() {
    const instance = map.current;
    if (!instance || !markers.current || !zones.current) return;
    drawConcelhoButton();
    markers.current.clearLayers();
    zones.current.clearLayers();
    markerByGroup.current.clear();
    const places = groupByPlace(state.current.incidents);
    for (const place of places) {
      const radius = place.byStatus[0].incidents[0].radiusM;
      if (radius) L.circle(place.latlng, { radius, color: INK, weight: 1.5, dashArray: "5 5", fillOpacity: 0.06, interactive: false }).addTo(zones.current);
    }
    for (const members of cluster(instance, places)) {
      if (members.length === 1) {
        const place = members[0];
        place.byStatus.forEach((group, index) => {
          const status = group.incidents[0].verificationStatus;
          // Estados diferentes no mesmo lugar ficam lado a lado, centrados no ponto.
          const offset = (index - (place.byStatus.length - 1) / 2) * 40;
          const marker = L.marker(group.latlng, { icon: markerIcon(status, group.incidents.length, offset), keyboard: true, riseOnHover: true })
            .bindPopup(() => popupHtml(group, state.current.selectedId), { maxWidth: 320, minWidth: 240, autoPanPadding: L.point(24, 24) })
            .addTo(markers.current!);
          label(marker, `${VERIFICATION_LABEL[status]}: ${plural(group.incidents.length)} em ${group.incidents[0].placeName}. Abrir detalhes`);
          marker.on("popupclose", () => marker.getElement()?.focus({ preventScroll: true }));
          markerByGroup.current.set(group.key, marker);
        });
      } else {
        const bounds = L.latLngBounds(members.map((place) => place.latlng));
        const all = members.flatMap((place) => place.byStatus.flatMap((group) => group.incidents));
        const names = [...new Set(members.map((place) => place.byStatus[0].incidents[0].placeName))];
        const marker = L.marker(bounds.getCenter(), { icon: markerIcon(null, all.length), keyboard: true })
          .on("click", () => instance.fitBounds(bounds.pad(0.6), { maxZoom: 14 }))
          .addTo(markers.current);
        label(marker, `${plural(all.length)} em ${names.join(", ")} (${statusBreakdown(all)}). Aproximar o mapa`);
        for (const place of members) for (const group of place.byStatus) markerByGroup.current.set(group.key, marker);
      }
    }
  }

  function label(marker: L.Marker, text: string) {
    const element = marker.getElement();
    element?.setAttribute("role", "button");
    element?.setAttribute("aria-label", text);
    element?.setAttribute("title", text);
  }

  // Filtros: redesenha marcadores e destaca a área escolhida.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    instance.closePopup();
    drawMarkers();
    styleBoundaries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidents, freguesia]);

  // Só a mudança de área reenquadra o mapa: mudar o tipo ou as datas não perde o zoom do visitante.
  useEffect(() => fitArea(), [freguesia]);

  /** Enquadra a freguesia escolhida, ou o concelho inteiro. */
  function fitArea() {
    const instance = map.current;
    const selected = state.current.freguesia;
    if (!instance) return;
    const layer = boundaries.current?.getLayers().find((item) => (item as L.GeoJSON & { feature: GeoJSON.Feature }).feature.properties?.slug === selected) as L.Polygon | undefined;
    if (selected && layer) instance.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 14 });
    // Com os limites carregados, o concelho ocupa o mapa todo, também num ecrã estreito.
    else if (!selected) instance.fitBounds(boundaries.current?.getBounds() ?? BOUNDS, { padding: [12, 12] });
  }

  // Escolha feita na lista: mostra o lugar e abre os detalhes.
  useEffect(() => {
    const instance = map.current;
    if (!instance || !focusRequest) return;
    const incident = state.current.incidents.find((item) => item.id === focusRequest.id);
    if (!incident) return;
    if (incident.precision === "CONCELHO") {
      openConcelho();
      return;
    }
    const key = groupKey(incident);
    const open = () => {
      const marker = markerByGroup.current.get(key);
      if (marker?.getPopup()) marker.openPopup();
    };
    const marker = markerByGroup.current.get(key);
    if (marker && marker.getPopup()) {
      instance.panTo(marker.getLatLng());
      open();
    } else {
      instance.once("zoomend", open);
      instance.setView([incident.latitude, incident.longitude], 14);
    }
    // As funções de desenho leem sempre o estado atual através de refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  return (
    <div
      ref={container}
      className="incident-map h-[58vh] min-h-[320px] w-full rounded-lg border border-line md:h-[520px]"
      role="region"
      aria-label="Mapa de ocorrências recentes no concelho de Torres Vedras"
      aria-describedby="mapa-instrucoes"
      onKeyDown={(event) => {
        if (event.key === "Escape") map.current?.closePopup();
      }}
    />
  );
}
