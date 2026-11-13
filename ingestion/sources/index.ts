import { StructureError } from "../types";
import { parseContratacao, parseGestao, parseRegulamentos } from "../parsers/camara";
import { collectCurated, collectCmAvisos, collectCmProciv, collectIpma, collectSmas } from "./alertas";
import {
  collectAmComposicao,
  collectAmDocumentos,
  collectAmEditais,
  collectAnuncios,
  collectCmAtas,
  collectCmComposicao,
  collectCmEditais,
  collectContratos,
  collectFinance,
  collectModificacoes,
  simple,
} from "./camara";
import { collectCuratedIncidents, collectGnr, collectMastodon, collectNoticiasAoMinuto, collectTelegram, newsFeedCollector } from "./incidentes";
import { collectIneCrime } from "./ine";
import { CM } from "./shared";
import type { Collector } from "./types";

export type { Collector, CollectorInput } from "./types";
export { newsFeedCollector } from "./incidentes";

export const COLLECTORS: Record<string, Collector> = {
  "gnr-comunicados": collectGnr,
  "noticias-ao-minuto": collectNoticiasAoMinuto,
  // A RTV Oeste publica cerca de dez artigos por dia: duas semanas são umas quinze páginas do feed.
  "rtv-oeste": newsFeedCollector({ feedUrl: "https://www.rtvon.pt/feed/", sourceName: "RTV Oeste", maxPages: 20 }),
  "onfm-torres-vedras": newsFeedCollector({ feedUrl: "https://onfm.pt/category/torres-vedras/feed/", sourceName: "ON FM", maxPages: 10, concelhoImplied: true }),
  "mastodon-torresvedras": collectMastodon,
  "telegram-canais": collectTelegram,
  "ocorrencias-curadas": collectCuratedIncidents,
  "ine-crime": collectIneCrime,
  "ipma-avisos": collectIpma,
  "cm-avisos": collectCmAvisos,
  "cm-prociv": collectCmProciv,
  "smas-avisos": collectSmas,
  "alertas-curados": collectCurated,
  "am-documentos": collectAmDocumentos,
  "am-editais": collectAmEditais,
  "am-situacao-financeira": collectFinance,
  "am-composicao": collectAmComposicao,
  "base-contratos": collectContratos,
  "base-anuncios": collectAnuncios,
  "base-modificacoes": collectModificacoes,
  "cm-editais": collectCmEditais,
  "cm-atas": collectCmAtas,
  "cm-gestao": simple(`${CM}/documentos/gestao/`, parseGestao, 50, "documentos de gestão"),
  "cm-regulamentos": simple(`${CM}/documentos/regulamentos/`, parseRegulamentos, 10, "regulamentos"),
  "cm-contratacao": simple(`${CM}/municipio/camara-municipal/contratacao-publica/`, parseContratacao, 5, "procedimentos"),
  "cm-composicao": collectCmComposicao,
};

export { StructureError };
