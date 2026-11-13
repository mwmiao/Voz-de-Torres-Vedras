import type { Agreement, IncidentCategory, IncidentPhase, SourceTier } from "@prisma/client";
import { FREGUESIAS } from "@/lib/alerts";
import {
  CONCELHO,
  CONCELHO_NAME,
  CONCELHO_POINT,
  FREGUESIA_POINTS,
  INCIDENT_CATEGORY_LABEL,
  lisbonDay,
  LOCALIDADES,
  PRECISION_RADIUS_M,
  shiftDay,
  WINDOW_DAYS,
  type IncidentFlag,
} from "@/lib/incidents";
import { searchKey } from "@/lib/search";
import { detectPersonalData, independenceKey, isArchivable, isReliable } from "@/lib/source-tiers";
import { fingerprintSimilarity } from "@/lib/verification";
import { sha256 } from "../fetchers/http";
import { cleanText, lisbonDate, MONTH_PATTERN, monthNumber } from "../normalizers";
import type { IncidentPlace, IncidentRecord, IncidentRejection } from "../types";

const DAY_MS = 86_400_000;

// ---------- Classificação ----------

/** Por ordem: a primeira regra que corresponde ao título é a categoria principal. */
const CATEGORY_RULES: [IncidentCategory, RegExp][] = [
  ["VIOLENCIA_DOMESTICA", /violencia domestica/],
  ["ROUBO", /\broub|\bassalt|carjacking|esticao/],
  ["FURTO", /\bfurt/],
  ["AGRESSAO", /\bagress|\bagredid|esfaque|ofensas? a integridade fisica|\brixa/],
  ["INCENDIO", /incendi|\bfogo\b|\bchamas\b|deflagr/],
  ["ACIDENTE", /acidente|colisao|despiste|atropel|capot|choque entre/],
  ["DANOS", /\bdanos\b|vandal|danificad/],
  ["PROTECAO_CIVIL", /protecao civil|inundac|\bcheias?\b|queda de arvore|deslizamento|derrocada|mau tempo|tempestade|\bsismo/],
  ["TRANSITO", /\btransito\b|conducao sob|taxa de alcool|excesso de velocidade|sem habilitacao|sem carta\b|estrada cortada|corte de estrada|operacao stop/],
  // Inclui investigações sem crime ainda definido: «a PJ investiga» é uma ocorrência, mesmo sem tipo confirmado.
  ["SEGURANCA_PUBLICA", /\bdetid|\bdetenc|apreend|apreens|trafico|estupefac|\barmas?\b|desaparecid|\bburla|ameaca|investig|policia judiciaria|\bpj\b|policia maritima|contrabando|suspeit/],
];

/** Iniciativas, balanços e campanhas não são ocorrências. */
const NOT_AN_INCIDENT = /\bcampanha\b|sensibiliza|\bbalanco\b|atividade operacional|acao de formacao|\bexercicio\b|\bsimulacro\b|dia (mundial|nacional|internacional)/;

/** Indício de que um título é sobre uma ocorrência: só esses artigos são abertos. */
export const INCIDENT_HINT = new RegExp(CATEGORY_RULES.map(([, rule]) => rule.source).join("|"));

/** Autoridades que, nas etiquetas de um artigo, indicam uma ocorrência mesmo com um título sem palavras-chave. */
const AUTHORITY_HINT = /\bgnr\b|guarda nacional republicana|\bpsp\b|policia|\bpj\b|bombeiros|protecao civil|\banepc\b|\binem\b/;

/** Pré-filtro dos feeds: o título ou as etiquetas da fonte sugerem uma ocorrência. */
export function looksLikeIncident(title: string, categories: string[] = []): boolean {
  const head = searchKey(title);
  const tags = searchKey(categories.join(" "));
  return INCIDENT_HINT.test(head) || INCIDENT_HINT.test(tags) || AUTHORITY_HINT.test(tags);
}

export function classifyIncident(title: string, text: string): { category: IncidentCategory; tags: string[]; confident: boolean } | null {
  const head = searchKey(title);
  const all = searchKey(title, text);
  const inTitle = CATEGORY_RULES.filter(([, rule]) => rule.test(head)).map(([category]) => category);
  const inText = CATEGORY_RULES.filter(([, rule]) => rule.test(all)).map(([category]) => category);
  const category = inTitle[0] ?? inText[0];
  if (!category) return null;
  const tags = [...new Set([...inTitle, ...inText])].filter((item) => item !== category).map((item) => INCIDENT_CATEGORY_LABEL[item]);
  return { category, tags, confident: inTitle.length > 0 };
}

// ---------- Área geográfica ----------

/** Concelhos vizinhos: uma notícia que também os refere pode não ser sobre Torres Vedras. */
const OTHER_CONCELHOS = ["lourinha", "mafra", "sobral de monte agraco", "cadaval", "alenquer", "bombarral", "arruda dos vinhos", "caldas da rainha", "peniche", "obidos", "sintra", "loures"];
/** Só conta um nome de lugar precedido de uma preposição: «Silveira» também é um apelido. */
const LOCATIVE = "(?:em|na|no|nas|nos|de|da|do|das|dos|freguesia d[aeo]|localidade d[aeo]|lugar d[aeo]|zona d[aeo])";

const placeRegex = (pattern: string) => new RegExp(`(?:^|[^a-z0-9])${LOCATIVE}\\s+${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^a-z0-9])`, "g");
const mentions = (key: string, pattern: string) => new RegExp(`(?:^|[^a-z0-9])${pattern}(?=$|[^a-z0-9])`).test(key);
const mentionsAsPlace = (key: string, pattern: string) => new RegExp(`(?:^|[^a-z0-9])(?:em|na|no|nas|nos|concelho d[aeo]|freguesia d[aeo]|zona d[aeo])\\s+${pattern}(?=$|[^a-z0-9])`).test(key);

export const mentionsConcelho = (text: string) => mentions(searchKey(text), "torres vedras");


const FREGUESIA_NAME = Object.fromEntries(FREGUESIAS.map((item) => [item.slug, item.name]));

export function freguesiaPlace(slug: string): IncidentPlace | null {
  const point = FREGUESIA_POINTS[slug];
  if (!point) return null;
  return { freguesiaSlug: slug, placeName: FREGUESIA_NAME[slug], precision: "FREGUESIA", latitude: point[0], longitude: point[1], radiusM: null };
}

/** Só o concelho: o ponto serve para ancorar o painel do mapa, e a área é o concelho inteiro. */
export function concelhoPlace(): IncidentPlace {
  return { freguesiaSlug: CONCELHO, placeName: CONCELHO_NAME, precision: "CONCELHO", latitude: CONCELHO_POINT[0], longitude: CONCELHO_POINT[1], radiusM: null };
}

export function localidadePlace(name: string): IncidentPlace | null {
  const item = LOCALIDADES.find((localidade) => localidade.name === name);
  if (!item) return null;
  return { freguesiaSlug: item.freguesia, placeName: item.name, precision: "LOCALIDADE", latitude: item.point[0], longitude: item.point[1], radiusM: PRECISION_RADIUS_M.LOCALIDADE };
}

/**
 * Lugar mais específico que o texto nomeia, nunca uma morada. Devolve também as dúvidas:
 * com mais do que uma freguesia, ou com outros concelhos, o registo fica por verificar.
 */
export type PlaceDetection = {
  place: IncidentPlace | null;
  /** O texto refere Torres Vedras. */
  concelho: boolean;
  multipleFreguesias: boolean;
  /** Concelhos vizinhos nomeados como lugar. */
  otherConcelhos: string[];
};

/** Dúvidas de uma deteção, em texto para a fila de revisão. */
export function placeDoubts({ multipleFreguesias, otherConcelhos }: Pick<PlaceDetection, "multipleFreguesias" | "otherConcelhos">): string[] {
  return [...(multipleFreguesias ? ["refere mais do que uma freguesia"] : []), ...(otherConcelhos.length > 0 ? [`refere também outros concelhos (${otherConcelhos.join(", ")})`] : [])];
}

export function detectPlace(text: string): PlaceDetection {
  const key = searchKey(text).replaceAll("-", " ");
  const concelho = mentions(key, "torres vedras");
  const found: { index: number; place: IncidentPlace }[] = [];
  for (const localidade of LOCALIDADES) {
    for (const pattern of localidade.patterns) {
      // A cidade só conta com expressões como «cidade de Torres Vedras», que já incluem a preposição.
      const regex = localidade.name.startsWith("Torres Vedras") ? new RegExp(pattern, "g") : placeRegex(pattern);
      for (const match of key.matchAll(regex)) found.push({ index: match.index, place: localidadePlace(localidade.name)! });
    }
  }
  for (const freguesia of FREGUESIAS) {
    for (const pattern of freguesia.patterns) {
      for (const match of key.matchAll(placeRegex(pattern))) found.push({ index: match.index, place: freguesiaPlace(freguesia.slug)! });
    }
  }
  found.sort((a, b) => a.index - b.index);
  const multipleFreguesias = new Set(found.map((item) => item.place.freguesiaSlug)).size > 1;
  // Um concelho vizinho só conta como lugar («na Lourinhã», «no concelho de Sobral»), não como nome
  // de uma instituição («Bombeiros Voluntários da Lourinhã», «Esquadra de Investigação Criminal de Loures»).
  const otherConcelhos = OTHER_CONCELHOS.filter((name) => mentionsAsPlace(key, name));
  const first = found[0]?.place;
  // Uma localidade da mesma freguesia é mais específica do que a freguesia.
  const specific = first && found.find((item) => item.place.freguesiaSlug === first.freguesiaSlug && item.place.precision === "LOCALIDADE")?.place;
  return { place: specific ?? first ?? null, concelho, multipleFreguesias, otherConcelhos };
}

// ---------- Data e hora ----------

const WEEKDAYS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
/** Meio-dia UTC de um dia civil, para não mudar de data com o fuso. */
const at = (day: string) => new Date(`${day}T12:00:00Z`);

/**
 * Data da ocorrência, como o texto a indica: uma data escrita ou uma referência relativa à publicação
 * («ontem», «no sábado»). Sem nenhuma das duas, devolve nulo: a data não se deduz.
 */
export function parseIncidentDate(rawText: string, published: Date): { start: Date; hasTime: boolean } | null {
  const text = searchKey(rawText);
  const publishedDay = lisbonDay(published);
  let day: string | null = null;

  const explicit = [...text.matchAll(new RegExp(`(?:dia\\s+)?(\\d{1,2})\\s+de\\s+${MONTH_PATTERN}(?:\\s+de\\s+(\\d{4}))?`, "g"))];
  for (const match of explicit) {
    const month = monthNumber(match[2]);
    const year = match[3] ? Number(match[3]) : Number(publishedDay.slice(0, 4));
    let candidate = `${year}-${String(month).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
    // Sem ano, uma data posterior à publicação é do ano anterior.
    if (!match[3] && candidate > shiftDay(publishedDay, 1)) candidate = `${year - 1}${candidate.slice(4)}`;
    const age = (at(publishedDay).getTime() - at(candidate).getTime()) / DAY_MS;
    if (age >= -1 && age <= 60) {
      day = candidate;
      break;
    }
  }

  if (!day) {
    if (/\banteontem\b/.test(text)) day = shiftDay(publishedDay, -2);
    else if (/\bontem\b/.test(text)) day = shiftDay(publishedDay, -1);
    else if (/\bhoje\b|\besta (manha|tarde|noite|madrugada)\b/.test(text)) day = publishedDay;
    else {
      const weekday = text.match(/\b(?:no|na|neste|nesta|este|esta|deste|desta|de|ao|a)\s+(?:(?:noite|madrugada|manha|tarde)\s+de\s+)?(domingo|segunda|terca|quarta|quinta|sexta|sabado)\b/);
      if (weekday) {
        const target = WEEKDAYS.indexOf(weekday[1]);
        const current = at(publishedDay).getUTCDay();
        day = shiftDay(publishedDay, -((current - target + 7) % 7));
      }
    }
  }
  if (!day) return null;

  const time = text.match(/\b(?:pelas|cerca das|por volta das|as|a)\s+(\d{1,2})(?:h(\d{2})?|:(\d{2}))\b/);
  const [year, month, date] = day.split("-").map(Number);
  if (time) {
    const hours = Number(time[1]);
    const minutes = Number(time[2] ?? time[3] ?? 0);
    if (hours < 24 && minutes < 60) return { start: lisbonDate(year, month, date, hours, minutes), hasTime: true };
  }
  return { start: at(day), hasTime: false };
}

// ---------- Fase, desmentidos e indícios ----------

const DYNAMIC: IncidentCategory[] = ["INCENDIO", "ACIDENTE", "TRANSITO", "PROTECAO_CIVIL"];

/** Só usa a fase que a fonte afirma, e só em ocorrências que mudam de estado. */
export function detectPhase(text: string, category: IncidentCategory): IncidentPhase | null {
  if (!DYNAMIC.includes(category)) return null;
  const key = searchKey(text);
  if (/(foi|esta|ficou|encontra-se) (dado como )?(extint|dominad|resolvid)|circulacao (foi |ja )?(restabelecida|reposta)|(estrada|via) (foi |ja )?reaberta/.test(key)) return "RESOLVIDO";
  if (/\bem curso\b|(continua|permanece|mantem-se) (ativo|a arder|cortad|condicionad)|\ba decorrer\b|\bneste momento\b/.test(key)) return "EM_CURSO";
  return null;
}

/** A fonte nega que a ocorrência tenha acontecido como foi descrita. */
export const DENIAL = /desment|nao se confirm|falso alarme|nao ha registo|sem registo de|informacao falsa|nao corresponde a verdade|e falsa\b/;

/** Indícios guardados como palavras-chave, nunca como texto. */
export function detectFlags(text: string): IncidentFlag[] {
  const key = searchKey(text);
  const flags: IncidentFlag[] = [];
  if (/homicid|\bmort[eoa]s?\b|violac|abuso sexual|\brapto|sequestr|esfaque|\btiros?\b|baleado|arma de fogo/.test(key)) flags.push("grave");
  if (/\bmenor(es)?\b|crianc|\bbebe\b|\balun[oa]s?\b|\bescola\b|adolescente|jovem de 1[0-7] anos/.test(key)) flags.push("menores");
  if (/agress|agredid|espanc|violencia/.test(key)) flags.push("violencia");
  if (DENIAL.test(key)) flags.push("desmentido");
  // Notícia ainda incompleta: fica «Em apuramento» enquanto for recente.
  if (/ultima hora|em atualizacao|a aguardar confirmacao|aguarda(-se)? confirmacao|ainda (nao ha|sem) informac|desconhece-se|ainda nao e conhecid/.test(key)) flags.push("em-desenvolvimento");
  return flags;
}

// ---------- Resumo e impressões ----------

const SUMMARY_LEAD: Record<IncidentCategory, string> = {
  ROUBO: "Roubo",
  FURTO: "Furto",
  VIOLENCIA_DOMESTICA: "Caso de violência doméstica",
  AGRESSAO: "Agressão",
  DANOS: "Danos",
  TRANSITO: "Ocorrência de trânsito",
  INCENDIO: "Incêndio",
  ACIDENTE: "Acidente",
  SEGURANCA_PUBLICA: "Ocorrência de segurança pública",
  PROTECAO_CIVIL: "Ocorrência de proteção civil",
  OUTRO: "Ocorrência",
};

/**
 * Resumo feito de um modelo: nunca copia nomes, idades, moradas, matrículas ou outros pormenores.
 * Diz só o tipo e a área; o estado de verificação aparece ao lado.
 */
export function neutralSummary(category: IncidentCategory, place: Pick<IncidentPlace, "placeName" | "precision">): string {
  const where =
    place.precision === "CONCELHO" ? "no concelho de Torres Vedras, sem freguesia indicada na fonte" : place.precision === "FREGUESIA" ? `na área da freguesia de ${place.placeName}` : `na zona de ${place.placeName}`;
  return `${SUMMARY_LEAD[category]} ${where}.`;
}

/** Afirmação estruturada de uma fonte: tipo, área e dia. Substitui qualquer excerto do texto original. */
export function structuredClaim(category: IncidentCategory, place: Pick<IncidentPlace, "placeName">, start: Date, denies: boolean): string {
  return `${denies ? "Desmente: " : ""}${INCIDENT_CATEGORY_LABEL[category]} · ${place.placeName} · ${start.toISOString().slice(0, 10)}`;
}

const STOPWORDS = new Set(["para", "pela", "pelo", "com", "sem", "apos", "entre", "sobre", "contra", "durante", "quando", "onde", "esta", "este", "foram", "sido", "torres", "vedras"]);

/** Impressões curtas das palavras: permitem comparar textos sem os guardar. */
export function titleFingerprint(title: string): string {
  const words = searchKey(title).split(/[^a-z0-9]+/).filter((word) => word.length >= 4 && !STOPWORDS.has(word));
  return [...new Set(words.map((word) => sha256(word).slice(0, 6)))].sort().join(" ");
}

export { fingerprintSimilarity };

// ---------- Factos e montagem ----------
//
// Um relato passa por duas etapas. A extração lê o texto e devolve factos: tipo, lugar, data, indícios.
// A montagem junta os factos à fonte e aplica todas as regras de política, as mesmas para artigos,
// publicações e registos à mão: privacidade, nível do concelho, data em falta, ligação publicada.

/** O que se sabe de uma ocorrência, venha de um texto ou de um registo à mão. */
export type IncidentFacts = {
  category: IncidentCategory;
  tags: string[];
  place: IncidentPlace;
  /** Nula quando a fonte não indica a data da ocorrência. */
  incidentStart: Date | null;
  incidentEnd?: Date | null;
  hasTime: boolean;
  phase: IncidentPhase | null;
  flags: IncidentFlag[];
  doubts: string[];
  denies: boolean;
  /** Dados pessoais encontrados na publicação, ou declarados por quem a registou. */
  personalData: string[];
  /**
   * Texto usado só para as impressões digitais: nunca é guardado. Sem texto, como num registo à mão
   * sem título, usa-se o tipo e o lugar final.
   */
  fingerprint?: { title: string; full: string };
};

/** De onde vem o relato. */
export type IncidentSource = {
  url: string;
  sourceName: string;
  sourceTier: SourceTier;
  publishedAt: Date;
  author?: string | null;
  articleCategory?: string | null;
  /** Conta em rede social, quando a fonte é uma publicação. */
  account?: { platform: string; handle: string } | null;
  engagement?: number;
  /** Ligação explícita a uma ocorrência existente, nos registos à mão. */
  incidentKey?: string;
  agreement?: Agreement;
};

const reject = (sourceUrl: string, reason: string): IncidentRejection => ({ kind: "incident-rejected", sourceUrl, reason });

/** Freguesia conhecida, ou o concelho inteiro, com o ponto dentro do concelho. */
function isInsideConcelho(place: IncidentPlace): boolean {
  const known = Boolean(FREGUESIA_POINTS[place.freguesiaSlug]) || (place.freguesiaSlug === CONCELHO && place.precision === "CONCELHO");
  return known && place.latitude > 38.98 && place.latitude < 39.25 && place.longitude > -9.45 && place.longitude < -9.1;
}

/** Políticas de lugar: violência doméstica só ao nível da freguesia, áreas públicas só de fontes fiáveis. */
function safePlace(place: IncidentPlace, category: IncidentCategory, tier: SourceTier): IncidentPlace {
  // Em violência doméstica, uma localidade pequena pode identificar as pessoas: fica a freguesia.
  const tooPrecise = category === "VIOLENCIA_DOMESTICA" || (place.precision === "AREA_PUBLICA" && !isReliable(tier));
  if (!tooPrecise || place.precision === "FREGUESIA" || place.precision === "CONCELHO") return place;
  return freguesiaPlace(place.freguesiaSlug) ?? place;
}

/** Junta factos e fonte num relato pronto a gravar, ou explica porque é recusado. */
export function assembleIncident(source: IncidentSource, facts: IncidentFacts, now: Date): IncidentRecord | IncidentRejection {
  const reliable = isReliable(source.sourceTier);
  if (!/^https?:\/\//.test(source.url)) return reject(source.url, "ligação inválida");
  if (Number.isNaN(source.publishedAt.getTime()) || (facts.incidentStart && Number.isNaN(facts.incidentStart.getTime()))) return reject(source.url, "data inválida");
  if (!isInsideConcelho(facts.place)) return reject(source.url, `lugar fora do concelho: ${facts.place.placeName}`);
  // Autoridades e imprensa podem ficar ao nível do concelho e sem data; redes sociais não.
  if (facts.place.precision === "CONCELHO" && !reliable) return reject(source.url, "sem área geográfica utilizável: a fonte só indica o concelho");
  if (!facts.incidentStart && !reliable) return reject(source.url, "sem data da ocorrência");
  const start = facts.incidentStart ?? source.publishedAt;
  if (start.getTime() < now.getTime() - (WINDOW_DAYS + 1) * DAY_MS) return reject(source.url, `ocorrência com mais de ${WINDOW_DAYS} dias`);

  const place = safePlace(facts.place, facts.category, source.sourceTier);
  const fingerprint = facts.fingerprint ?? { title: `${facts.category} ${place.placeName}`, full: `${facts.category} ${place.placeName}` };
  // Em redes sociais e fontes comunitárias, a ligação só é publicada sem dados pessoais e quando pode ser arquivada.
  const linkNote = !isArchivable(source.url)
    ? "Ligação não publicada: a publicação não pode ser arquivada."
    : !reliable && facts.personalData.length > 0
      ? "Ligação não publicada: a publicação original contém dados pessoais."
      : null;

  return {
    kind: "incident",
    sourceUrl: source.url,
    sourceName: source.sourceName,
    sourceTier: source.sourceTier,
    independenceKey: independenceKey(source.url, source.author, source.account),
    author: source.author ?? null,
    articleCategory: source.articleCategory ?? null,
    publishedAt: source.publishedAt,
    incidentStart: start,
    incidentEnd: facts.incidentEnd ?? null,
    hasTime: facts.incidentStart ? facts.hasTime : false,
    category: facts.category,
    tags: facts.tags,
    summary: neutralSummary(facts.category, place),
    claim: structuredClaim(facts.category, place, start, facts.denies),
    titleFingerprint: titleFingerprint(fingerprint.title),
    textFingerprint: titleFingerprint(fingerprint.full),
    phase: facts.phase,
    denies: facts.denies,
    flags: facts.incidentStart ? facts.flags : [...facts.flags, "data-da-publicacao"],
    doubts: facts.doubts,
    linkPublic: linkNote === null,
    linkNote,
    engagement: source.engagement ?? 0,
    incidentKey: source.incidentKey,
    agreement: source.agreement,
    ...place,
  };
}

export type ArticleInput = Omit<IncidentSource, "publishedAt" | "incidentKey" | "agreement"> & {
  /** Para publicações sem título, a primeira frase. */
  title: string;
  text: string;
  published: Date | null;
  /** A fonte só publica sobre Torres Vedras, como uma categoria local: a menção ao concelho é implícita. */
  concelhoImplied?: boolean;
  now: Date;
};

/** Primeira frase de uma publicação, usada como título. */
export const firstSentence = (text: string) => cleanText(text).split(/(?<=[.!?])\s/)[0].slice(0, 160);

/** Lê os factos de um artigo ou publicação e monta o relato, ou explica porque foi recusado. */
export function buildIncident(input: ArticleInput): IncidentRecord | IncidentRejection {
  const { url, title, text, published, now } = input;
  const full = `${title}. ${text}`;
  if (!published) return reject(url, "sem data de publicação");
  if (NOT_AN_INCIDENT.test(searchKey(title))) return reject(url, "não descreve uma ocorrência (campanha, balanço ou iniciativa)");
  const classification = classifyIncident(title, text);
  if (!classification) return reject(url, "não descreve uma ocorrência reconhecida");
  const detection = detectPlace(full);
  const { place, concelho, otherConcelhos } = detection;
  // Há lugares com o mesmo nome noutros concelhos, como Maceira ou Santa Cruz.
  if (!concelho && !input.concelhoImplied) return reject(url, "não refere o concelho de Torres Vedras");
  // Hospitais, tribunais e destacamentos com sede em Torres Vedras aparecem em notícias de outros concelhos.
  if (!place && otherConcelhos.length > 0) return reject(url, `a ocorrência é noutro concelho: (${otherConcelhos.join(", ")})`);
  const doubts = placeDoubts(detection);
  const date = parseIncidentDate(full, published);
  const flags = detectFlags(full);
  const unofficial = !isReliable(input.sourceTier);

  return assembleIncident(
    { ...input, publishedAt: published },
    {
      category: classification.category,
      tags: classification.tags,
      place: place ?? concelhoPlace(),
      incidentStart: date?.start ?? null,
      hasTime: date?.hasTime ?? false,
      phase: detectPhase(full, classification.category),
      flags,
      doubts: classification.confident ? doubts : [...doubts, "a categoria só foi encontrada no corpo do texto"],
      denies: flags.includes("desmentido"),
      personalData: unofficial ? detectPersonalData(full) : [],
      fingerprint: { title, full },
    },
    now,
  );
}
