import type { Agreement, GeoPrecision, IncidentCategory, IncidentPhase, Prisma, SourceTier, VerificationStatus } from "@prisma/client";

/** O mapa nunca mostra ocorrências com mais de duas semanas. */
export const WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

export const LOCATION_DISCLAIMER =
  "As localizações são aproximadas e destinam-se apenas a contexto público. Não representam uma localização exata nem uma avaliação de segurança.";
export const EMPTY_MESSAGE = "Sem ocorrências publicadas nas últimas duas semanas para esta área.";
export const METHOD_INTRO =
  "Esta secção reúne ocorrências recentes reportadas por fontes oficiais, meios de comunicação e fontes locais. Os casos não confirmados são identificados como tal e não devem ser interpretados como factos confirmados.";
export const CONFLICT_NOTE = "Existem relatos contraditórios. Consulte as fontes.";

export const INCIDENT_CATEGORY_LABEL: Record<IncidentCategory, string> = {
  ROUBO: "Roubo",
  FURTO: "Furto",
  VIOLENCIA_DOMESTICA: "Violência doméstica",
  AGRESSAO: "Agressão",
  DANOS: "Danos",
  TRANSITO: "Trânsito",
  INCENDIO: "Incêndio",
  ACIDENTE: "Acidente",
  SEGURANCA_PUBLICA: "Segurança pública",
  PROTECAO_CIVIL: "Proteção civil",
  OUTRO: "Outro",
};

export const INCIDENT_CATEGORIES = Object.keys(INCIDENT_CATEGORY_LABEL) as IncidentCategory[];

/** Estados públicos. Só «Confirmado» pode ser descrito como confirmado. */
export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  CONFIRMADO: "Confirmado",
  REPORTADO: "Reportado",
  NAO_CONFIRMADO: "Não confirmado",
  EM_APURAMENTO: "Em apuramento",
};

export const VERIFICATION_STATUSES: VerificationStatus[] = ["CONFIRMADO", "REPORTADO", "NAO_CONFIRMADO", "EM_APURAMENTO"];

export const VERIFICATION_HELP: Record<VerificationStatus, string> = {
  CONFIRMADO: "Confirmado por uma autoridade oficial: GNR, PSP, Proteção Civil, ANEPC, IPMA, Câmara Municipal ou registo público.",
  REPORTADO: "Noticiado por um órgão de comunicação social com responsabilidade editorial, sem confirmação oficial no registo.",
  NAO_CONFIRMADO: "Vem de redes sociais, páginas comunitárias ou relatos de residentes. Não deve ser lido como facto confirmado.",
  EM_APURAMENTO: "Situação recente ou em curso, com dados incompletos ou à espera de confirmação. Volta a ser verificada quando surge informação nova.",
};

export const PHASE_LABEL: Record<IncidentPhase, string> = {
  EM_CURSO: "em curso",
  RESOLVIDO: "resolvida",
};

export const SOURCE_TIER_LABEL: Record<SourceTier, string> = {
  OFICIAL: "Autoridade oficial",
  IMPRENSA: "Comunicação social",
  CONTA_OFICIAL: "Conta oficial em rede social",
  COMUNITARIA: "Fonte comunitária ou não oficial",
};

export const SOURCE_TIER_NUMBER: Record<SourceTier, number> = { OFICIAL: 1, IMPRENSA: 2, CONTA_OFICIAL: 3, COMUNITARIA: 4 };

export const AGREEMENT_LABEL: Record<Agreement, string> = {
  CORROBORA: "Corrobora",
  CONTRADIZ: "Contradiz",
  ACRESCENTA: "Acrescenta detalhe",
  NAO_RELACIONADO: "Não relacionada",
};

/** Limites da revisão e do arquivo. Podem ser ajustados por variáveis de ambiente na recolha. */
export const REVIEW_DEFAULTS = {
  /** Horas em que uma ocorrência de fonte não oficial fica «Em apuramento». */
  developingHours: 24,
  /** Horas sem confirmação até a ocorrência entrar na fila de revisão. */
  unconfirmedReviewHours: 48,
  /** Dias sem confirmação até ser arquivada. */
  unconfirmedArchiveDays: 7,
  /** Publicações não oficiais sobre a mesma ocorrência que levam a revisão. */
  repetitionThreshold: 5,
  /** Partilhas e gostos somados que levam a revisão. */
  engagementThreshold: 50,
};

export const PRECISION_LABEL: Record<GeoPrecision, string> = {
  CONCELHO: "Concelho",
  FREGUESIA: "Freguesia",
  LOCALIDADE: "Localidade",
  AREA_PUBLICA: "Área pública",
  ZONA_APROXIMADA: "Zona aproximada",
};

/**
 * Ponto interior de cada freguesia, calculado sobre os limites da CAOP 2025.
 * É aqui que fica o marcador quando a fonte só indica a freguesia.
 */
export const FREGUESIA_POINTS: Record<string, [number, number]> = {
  "a-dos-cunhados": [39.1524, -9.3217],
  "campelos-outeiro-cabeca": [39.1905, -9.2184],
  "carvoeira-carmoes": [39.0694, -9.1473],
  "dois-portos": [39.0366, -9.1856],
  freiria: [39.0286, -9.3176],
  maceira: [39.1809, -9.3434],
  "maxial-monte-redondo": [39.1336, -9.1822],
  "ponte-do-rol": [39.1005, -9.3176],
  ramalhal: [39.1599, -9.2269],
  runa: [39.0659, -9.206],
  "santa-maria-sao-pedro-matacaes": [39.0874, -9.2436],
  "sao-pedro-da-cadeira": [39.0743, -9.385],
  silveira: [39.1144, -9.3612],
  turcifal: [39.0356, -9.2623],
  ventosa: [39.0608, -9.3195],
};

/**
 * Localidades com nome próprio dentro de uma freguesia. O ponto é o centro do lugar no OpenStreetMap,
 * arredondado, e é sempre mostrado com um raio: nunca aponta uma rua ou um edifício.
 * `patterns` é texto sem acentos, como em searchKey.
 */
export const LOCALIDADES = [
  { name: "Torres Vedras (cidade)", patterns: ["cidade de torres vedras", "centro de torres vedras", "centro da cidade de torres vedras"], freguesia: "santa-maria-sao-pedro-matacaes", point: [39.0915, -9.259] },
  { name: "Santa Cruz", patterns: ["santa cruz"], freguesia: "silveira", point: [39.1351, -9.3817] },
  { name: "Porto Novo", patterns: ["porto novo"], freguesia: "maceira", point: [39.1772, -9.3553] },
  { name: "Póvoa de Penafirme", patterns: ["povoa de penafirme"], freguesia: "a-dos-cunhados", point: [39.1454, -9.3616] },
  { name: "Assenta", patterns: ["assenta"], freguesia: "sao-pedro-da-cadeira", point: [39.0614, -9.4073] },
  { name: "Cambelas", patterns: ["cambelas"], freguesia: "sao-pedro-da-cadeira", point: [39.0798, -9.4131] },
  { name: "Matacães", patterns: ["matacaes"], freguesia: "santa-maria-sao-pedro-matacaes", point: [39.0932, -9.2107] },
  { name: "Varatojo", patterns: ["varatojo"], freguesia: "santa-maria-sao-pedro-matacaes", point: [39.0908, -9.2773] },
  { name: "Maxial", patterns: ["maxial"], freguesia: "maxial-monte-redondo", point: [39.1382, -9.1778] },
  { name: "Monte Redondo", patterns: ["monte redondo"], freguesia: "maxial-monte-redondo", point: [39.1165, -9.1999] },
  { name: "Ermegeira", patterns: ["ermegeira"], freguesia: "maxial-monte-redondo", point: [39.1332, -9.1945] },
  { name: "Campelos", patterns: ["campelos"], freguesia: "campelos-outeiro-cabeca", point: [39.1901, -9.2367] },
  { name: "Outeiro da Cabeça", patterns: ["outeiro da cabeca"], freguesia: "campelos-outeiro-cabeca", point: [39.1807, -9.1692] },
  { name: "Carvoeira", patterns: ["carvoeira"], freguesia: "carvoeira-carmoes", point: [39.0816, -9.1631] },
  { name: "Carmões", patterns: ["carmoes"], freguesia: "carvoeira-carmoes", point: [39.0534, -9.138] },
] as const satisfies readonly { name: string; patterns: readonly string[]; freguesia: string; point: readonly [number, number] }[];

/** Valor de freguesia para ocorrências que a fonte só situa no concelho. */
export const CONCELHO = "concelho";
export const CONCELHO_NAME = "Concelho de Torres Vedras";
/** Ponto médio da área do concelho: só serve para ancorar o painel, nunca como marcador. */
export const CONCELHO_POINT: [number, number] = [39.1049, -9.2604];

/** Raio da zona mostrada para cada nível de precisão, em metros. */
export const PRECISION_RADIUS_M: Record<GeoPrecision, number | null> = {
  CONCELHO: null,
  FREGUESIA: null,
  LOCALIDADE: 900,
  AREA_PUBLICA: 400,
  ZONA_APROXIMADA: 1500,
};

export const BOUNDARIES_URL = "/geo/freguesias-torres-vedras.json";
export const BOUNDARIES_SOURCE = { label: "CAOP 2025, Direção-Geral do Território", url: "https://www.dgterritorio.gov.pt/cartografia/cartografia-tematica/caop" };

/** Dia civil em Lisboa, como AAAA-MM-DD. */
export function lisbonDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(date);
}

/** Dia civil AAAA-MM-DD deslocado um número de dias. */
export const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day}T12:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** Primeiro dia da janela: até 14 dias antes de hoje, inclusive. A 2 de novembro, começa a 19 de outubro. */
export const windowStartDay = (now: Date) => shiftDay(lisbonDay(now), -WINDOW_DAYS);
/** Início da janela em UTC: meia-noite de Lisboa do primeiro dia, com uma hora de margem para a hora de verão. */
export const windowStart = (now: Date) => new Date(Date.parse(`${windowStartDay(now)}T00:00:00Z`) - 3_600_000);

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Intervalo escolhido pelo visitante, sempre limitado aos últimos 14 dias. */
export function clampRange(now: Date, from?: string, to?: string): { from: string; to: string; min: string; max: string } {
  const min = windowStartDay(now);
  const max = lisbonDay(now);
  const clamp = (value: string | undefined, fallback: string) => (value && DAY_RE.test(value) ? (value < min ? min : value > max ? max : value) : fallback);
  let start = clamp(from, min);
  let end = clamp(to, max);
  if (start > end) [start, end] = [end, start];
  return { from: start, to: end, min, max };
}

export const isInRange = (date: Date, range: { from: string; to: string }) => {
  const day = lisbonDay(date);
  return day >= range.from && day <= range.to;
};

export type PublicReference = {
  sourceName: string;
  sourceTier: SourceTier;
  /** Nulo quando a ligação não é publicada. */
  url: string | null;
  publicationDate: string;
  agreement: Agreement;
  duplicate: boolean;
  /** Primeira fonte a relatar, quando aparece outra como fonte principal. */
  firstReport?: boolean;
};

/** Ocorrência como é enviada para o mapa: só campos públicos. */
export type PublicIncident = {
  id: string;
  category: IncidentCategory;
  tags: string[];
  summary: string;
  sourceName: string;
  sourceTier: SourceTier;
  author: string | null;
  /** Nulo quando a publicação original expõe dados pessoais ou não pode ser arquivada. */
  sourceUrl: string | null;
  sourceLinkNote: string | null;
  verificationStatus: VerificationStatus;
  hasConflict: boolean;
  phase: IncidentPhase | null;
  lastCheckedAt: string;
  references: PublicReference[];
  incidentStart: string;
  incidentEnd: string | null;
  hasTime: boolean;
  publicationDate: string;
  retrievalDate: string;
  /** A fonte não dá a data da ocorrência: é usada a data de publicação. */
  dateIsPublication: boolean;
  freguesiaSlug: string;
  freguesiaName: string;
  placeName: string;
  precision: GeoPrecision;
  latitude: number;
  longitude: number;
  radiusM: number | null;
};

export type IncidentFilters = { area: string; tipo: string; estado: string; fonte: string; range: { from: string; to: string } };

type Filterable = Pick<PublicIncident, "freguesiaSlug" | "category" | "verificationStatus" | "incidentStart" | "sourceName"> & { references?: Pick<PublicReference, "sourceName">[] };

/** Fontes de uma ocorrência: a principal e as outras que a referem. */
export const sourceNamesOf = (item: Filterable) => [item.sourceName, ...(item.references ?? []).map((reference) => reference.sourceName)];

/** Filtros do mapa e da lista: área, tipo, estado de verificação, fonte e datas. Vazio significa todos. */
export function filterIncidents<T extends Filterable>(incidents: T[], filters: Partial<IncidentFilters>): T[] {
  return incidents.filter(
    (item) =>
      (!filters.area || item.freguesiaSlug === filters.area) &&
      (!filters.fonte || sourceNamesOf(item).includes(filters.fonte)) &&
      (!filters.tipo || item.category === filters.tipo) &&
      (!filters.estado || item.verificationStatus === filters.estado) &&
      (!filters.range || isInRange(new Date(item.incidentStart), filters.range)),
  );
}

/**
 * Consulta das ocorrências públicas: não arquivadas, não retidas e desde o início da janela, com margem.
 * O corte exato, pelo dia civil de Lisboa, faz-se depois com visibilityProblem.
 */
export const publicIncidentWhere = (now: Date): Prisma.IncidentWhereInput => ({ archivedAt: null, heldForReview: false, incidentStart: { gte: windowStart(now) } });

/** Porque é que uma ocorrência não aparece no mapa, ou nulo se aparece. */
export function visibilityProblem(incident: { archivedAt: Date | null; archiveReason: string | null; heldForReview: boolean; reviewReasons: string; incidentStart: Date }, at: Date): string | null {
  if (incident.archivedAt) return `arquivada: ${incident.archiveReason ?? "sem motivo"}`;
  if (incident.heldForReview) return `retida para revisão: ${incident.reviewReasons || "sem motivo"}`;
  if (lisbonDay(incident.incidentStart) < windowStartDay(at)) return `fora da janela: ocorrência a ${lisbonDay(incident.incidentStart)}, janela desde ${windowStartDay(at)}`;
  return null;
}

/** Indícios que a extração encontra no texto, guardados como palavras-chave e nunca como texto. */
export const INCIDENT_FLAGS = ["grave", "menores", "violencia", "desmentido", "em-desenvolvimento", "data-da-publicacao"] as const;
export type IncidentFlag = (typeof INCIDENT_FLAGS)[number];

/** Listas gravadas como texto, porque o SQLite não tem listas: o separador de cada campo fica só aqui. */
const SEPARATOR = { tags: ", ", flags: ",", doubts: "; ", reviewReasons: "; " } as const;
export type StoredList = keyof typeof SEPARATOR;

export const encodeList = (field: StoredList, items: readonly string[]) => items.join(SEPARATOR[field]);
export const decodeList = (field: StoredList, text: string) => (text ? text.split(SEPARATOR[field]).filter(Boolean) : []);
/** Indícios desconhecidos, de versões anteriores, são ignorados. */
export const decodeFlags = (text: string): IncidentFlag[] => decodeList("flags", text).filter((flag): flag is IncidentFlag => (INCIDENT_FLAGS as readonly string[]).includes(flag));
