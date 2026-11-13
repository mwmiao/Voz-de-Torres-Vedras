"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { VerificationStatus } from "@prisma/client";
import { STATUS_CLASS, statusSvg } from "@/lib/incident-status";
import { BOUNDARIES_URL, CONCELHO_NAME, CONCELHO_POINT, PRECISION_LABEL, VERIFICATION_LABEL, VERIFICATION_STATUSES, type PublicIncident } from "@/lib/incidents";
import { IncidentPopup, type PopupContent } from "./IncidentPopup";

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
const POPUP_OPTIONS = { maxWidth: 320, minWidth: 240, autoPanPadding: L.point(24, 24) };
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
  /** Como abrir os detalhes de cada ocorrência, conforme o lugar onde ficou desenhada. */
  const openers = useRef(new Map<string, () => void>());
  const concelhoButton = useRef<HTMLButtonElement | null>(null);
  /** Popup aberto: o elemento onde o React desenha o conteúdo, e o que fazer ao fechar. */
  const [open, setOpen] = useState<(PopupContent & { element: HTMLElement }) | null>(null);
  const current = useRef<{ popup: L.Popup; onClose: () => void } | null>(null);
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
    instance.on("popupclose", (event) => {
      if (current.current?.popup !== event.popup) return;
      const { onClose } = current.current;
      current.current = null;
      setOpen(null);
      onClose();
    });
    instance.on("popupopen", (event) => {
      const close = event.popup.getElement()?.querySelector<HTMLAnchorElement>(".leaflet-popup-close-button");
      close?.setAttribute("aria-label", "Fechar detalhes");
      close?.setAttribute("title", "Fechar detalhes");
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

  /** Todos os popups abrem por aqui: o conteúdo é desenhado pelo React, no elemento do Leaflet. */
  function openPopup(content: PopupContent, latlng: L.LatLngExpression, offset: L.Point, onClose: () => void) {
    const instance = map.current;
    if (!instance) return;
    instance.closePopup();
    const element = document.createElement("div");
    const popup = L.popup({ ...POPUP_OPTIONS, offset }).setLatLng(latlng).setContent(element);
    current.current = { popup, onClose };
    popup.openOn(instance);
    setOpen({ ...content, element });
  }

  function concelhoIncidents() {
    return state.current.incidents.filter((item) => item.precision === "CONCELHO");
  }

  /** Ocorrências sem freguesia: o concelho inteiro fica realçado, sem marcador. */
  function openConcelho() {
    const instance = map.current;
    const items = concelhoIncidents();
    if (!instance || items.length === 0) return;
    instance.fitBounds(boundaries.current?.getBounds() ?? BOUNDS, { padding: [12, 12] });
    boundaries.current?.eachLayer((layer) => (layer as L.Path).setStyle({ weight: 2.5, opacity: 1, dashArray: "6 4", fillOpacity: 0.12, fillColor: INK }));
    openPopup({ title: CONCELHO_NAME, location: "concelho: a fonte não indica a freguesia", incidents: items }, CONCELHO_POINT, L.point(0, 7), () => {
      styleBoundaries();
      concelhoButton.current?.focus({ preventScroll: true });
    });
  }

  function drawConcelhoButton() {
    const button = concelhoButton.current;
    if (!button) return;
    const items = concelhoIncidents();
    button.hidden = items.length === 0;
    const text = `Concelho inteiro: ${plural(items.length)} sem freguesia indicada`;
    button.innerHTML = `<span aria-hidden="true" class="incident-concelho__count">${items.length}</span> ${escape(text)}`;
    button.setAttribute("aria-label", `${text} (${statusBreakdown(items)}). Abrir detalhes`);
    for (const incident of items) openers.current.set(incident.id, openConcelho);
  }

  function drawMarkers() {
    const instance = map.current;
    if (!instance || !markers.current || !zones.current) return;
    markers.current.clearLayers();
    zones.current.clearLayers();
    openers.current.clear();
    drawConcelhoButton();
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
          const first = group.incidents[0];
          const marker = L.marker(group.latlng, { icon: markerIcon(status, group.incidents.length, offset), keyboard: true, riseOnHover: true }).addTo(markers.current!);
          const show = () =>
            openPopup({ title: first.placeName, location: PRECISION_LABEL[first.precision].toLowerCase(), incidents: group.incidents }, group.latlng, L.point(offset, -11), () =>
              marker.getElement()?.focus({ preventScroll: true }),
            );
          marker.on("click", show);
          label(marker, `${VERIFICATION_LABEL[status]}: ${plural(group.incidents.length)} em ${first.placeName}. Abrir detalhes`);
          for (const incident of group.incidents) {
            openers.current.set(incident.id, () => {
              instance.panTo(group.latlng);
              show();
            });
          }
        });
      } else {
        const bounds = L.latLngBounds(members.map((place) => place.latlng));
        const all = members.flatMap((place) => place.byStatus.flatMap((group) => group.incidents));
        const names = [...new Set(members.map((place) => place.byStatus[0].incidents[0].placeName))];
        const marker = L.marker(bounds.getCenter(), { icon: markerIcon(null, all.length), keyboard: true })
          .on("click", () => instance.fitBounds(bounds.pad(0.6), { maxZoom: 14 }))
          .addTo(markers.current);
        label(marker, `${plural(all.length)} em ${names.join(", ")} (${statusBreakdown(all)}). Aproximar o mapa`);
        // Uma ocorrência num grupo abre-se depois de aproximar: o redesenho regista o marcador próprio.
        for (const incident of all) {
          openers.current.set(incident.id, () => {
            instance.once("zoomend", () => openers.current.get(incident.id)?.());
            instance.setView([incident.latitude, incident.longitude], 14);
          });
        }
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
    if (focusRequest) openers.current.get(focusRequest.id)?.();
  }, [focusRequest]);

  // Depois de o React desenhar o conteúdo, o Leaflet volta a medir o popup.
  useEffect(() => {
    current.current?.popup.update();
  }, [open]);

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
    >
      {open
        ? createPortal(
            <IncidentPopup
              title={open.title}
              location={open.location}
              incidents={open.incidents}
              selectedId={focusRequest?.id ?? null}
              onShowInList={(id) => {
                map.current?.closePopup();
                callbacks.current.onShowInList(id);
              }}
            />,
            open.element,
          )
        : null}
    </div>
  );
}
