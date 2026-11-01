import type { AlertSeverity, AlertType } from "@prisma/client";
import * as cheerio from "cheerio";
import { FREGUESIAS } from "@/lib/alerts";
import { searchKey } from "@/lib/search";
import { cleanText } from "../normalizers";
import type { AlertRecord } from "../types";

const DAY_MS = 86_400_000;
const CONCELHO = "Concelho de Torres Vedras";

/** Sem data de fim na fonte, um aviso fica entre os ativos durante este período e passa ao arquivo. */
export const DEFAULT_ACTIVE_DAYS = 14;
const CIVIL_PROTECTION_ACTIVE_DAYS = 3;
const MAX_DATES_IN_NOTICE = 2;
/** Acima disto, o aviso é geral: enumera freguesias, não as delimita. */
const MAX_NAMED_FREGUESIAS = 4;

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTH = `(${MONTHS.join("|")})`;

const utc = (year: number, month: number, day: number, hours = 12) => new Date(Date.UTC(year, month, day, hours));
const monthIndex = (name: string) => MONTHS.indexOf(name.toLowerCase());
const endOfDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59));

/** Datas sem ano referem-se ao ano da publicação, ou ao seguinte se já tivessem passado há muito. */
function withYear(day: number, month: number, year: string | undefined, published: Date): Date {
  if (year) return utc(Number(year), month, day);
  const candidate = utc(published.getUTCFullYear(), month, day);
  return published.getTime() - candidate.getTime() > 180 * DAY_MS ? utc(published.getUTCFullYear() + 1, month, day) : candidate;
}

/** "31 Outubro 2026" ou "30.10.2026". */
export function parsePublishedDate(text: string): Date | null {
  const dotted = text.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (dotted) return utc(Number(dotted[3]), Number(dotted[2]) - 1, Number(dotted[1]));
  const long = text.toLowerCase().match(new RegExp(`(\\d{1,2})\\s+(?:de\\s+)?${MONTH}\\s+(?:de\\s+)?(\\d{4})`));
  return long ? utc(Number(long[3]), monthIndex(long[2]), Number(long[1])) : null;
}

/** Lê o período de um aviso. Só devolve o que o texto afirma: sem datas claras, devolve nulos. */
export function parsePeriod(rawText: string, published: Date): { startsAt: Date | null; endsAt: Date | null } {
  const text = rawText.toLowerCase();
  // Um aviso com várias datas reúne vários casos: nenhuma delas é o fim do aviso.
  const dates = text.match(new RegExp(`\\d{1,2}\\s+de\\s+${MONTH}`, "g")) ?? [];
  if (dates.length > MAX_DATES_IN_NOTICE) return { startsAt: null, endsAt: null };
  const range = text.match(
    new RegExp(`(?:entre|de|desde)\\s+(?:o dia\\s+)?(\\d{1,2})(?:\\s+de\\s+${MONTH})?(?:\\s+de\\s+(\\d{4}))?\\s+(?:e|a|até)\\s+(?:o dia\\s+|ao dia\\s+|dia\\s+)?(\\d{1,2})\\s+de\\s+${MONTH}(?:\\s+de\\s+(\\d{4}))?`),
  );
  if (range) {
    const endMonth = monthIndex(range[5]);
    const end = withYear(Number(range[4]), endMonth, range[6], published);
    const startMonth = range[2] ? monthIndex(range[2]) : endMonth;
    const start = withYear(Number(range[1]), startMonth, range[3], published);
    const adjusted = start > end ? utc(start.getUTCFullYear() - 1, startMonth, Number(range[1])) : start;
    return { startsAt: adjusted, endsAt: endOfDay(end) };
  }
  const single = text.match(new RegExp(`\\bdia\\s+(\\d{1,2})\\s+de\\s+${MONTH}(?:\\s+de\\s+(\\d{4}))?`));
  if (single) {
    const date = withYear(Number(single[1]), monthIndex(single[2]), single[3], published);
    return { startsAt: date, endsAt: endOfDay(date) };
  }
  return { startsAt: null, endsAt: null };
}

/** Só refere freguesias quando a fonte as nomeia; caso contrário, o aviso é do concelho. */
export function detectFreguesias(text: string): string[] {
  const key = searchKey(text).replaceAll("-", " ");
  return FREGUESIAS.filter((freguesia) => freguesia.patterns.some((pattern) => key.includes(pattern))).map((freguesia) => freguesia.name);
}

export function classifyAlert(title: string, description: string): { type: AlertType; severity: AlertSeverity } {
  const head = searchKey(title);
  const all = searchKey(title, description);
  if (/falha de abastecimento|rutura/.test(head)) return { type: "AGUA", severity: "IMPORTANTE" };
  if (/interrupcao|abastecimento de agua|qualidade da agua/.test(head)) return { type: "AGUA", severity: "ATENCAO" };
  if (/corte de transito|transito|condicionamento|estrada|rua .*encerrad|circulacao/.test(head)) return { type: "MOBILIDADE", severity: "ATENCAO" };
  if (/transporte|autocarro|porta a porta|estacionamento/.test(head)) return { type: "MOBILIDADE", severity: "INFORMATIVO" };
  if (/residuos|recolha de lixo|recolha de monos/.test(all)) return { type: "RESIDUOS", severity: "INFORMATIVO" };
  if (/saude publica|delegado de saude|vacina|surto/.test(all)) return { type: "SAUDE", severity: "ATENCAO" };
  if (/protecao civil|incendio rural|aviso meteorologico/.test(all)) return { type: "PROTECAO_CIVIL", severity: "ATENCAO" };
  if (/consulta publica|discussao publica/.test(all)) return { type: "CONSULTA", severity: "INFORMATIVO" };
  if (/encerramento|encerrad|horario|fecha/.test(head)) return { type: "SERVICOS", severity: "INFORMATIVO" };
  return { type: "AVISO_MUNICIPAL", severity: "INFORMATIVO" };
}

function buildNotice(input: { url: string; title: string; description: string; published: Date | null; now: Date; activeDays?: number }): AlertRecord {
  const published = input.published ?? input.now;
  const { startsAt, endsAt } = parsePeriod(`${input.title} ${input.description}`, published);
  const { type, severity } = classifyAlert(input.title, input.description);
  const named = detectFreguesias(`${input.title} ${input.description}`);
  const freguesias = named.length > MAX_NAMED_FREGUESIAS ? [] : named;
  return {
    kind: "alert",
    key: input.url,
    title: input.title,
    type,
    severity,
    description: input.description.length > 320 ? `${input.description.slice(0, 317).trimEnd()}...` : input.description,
    startsAt,
    endsAt: endsAt ?? new Date(published.getTime() + (input.activeDays ?? DEFAULT_ACTIVE_DAYS) * DAY_MS),
    hasOfficialEnd: endsAt !== null,
    hasTime: false,
    area: freguesias.length > 0 ? freguesias.join(", ") : CONCELHO,
    areaType: freguesias.length > 0 ? "FREGUESIA" : "CONCELHO",
    publishedAt: input.published,
    sourceUrl: input.url,
  };
}

// ---------- IPMA ----------

export type IpmaWarning = { text: string; awarenessTypeName: string; idAreaAviso: string; startTime: string; endTime: string; awarenessLevelID: string };

export const IPMA_API = "https://api.ipma.pt/open-data/forecast/warnings/warnings_www.json";
export const IPMA_PAGE = "https://www.ipma.pt/pt/otempo/prev-sam/?p=LSB";

const IPMA_LEVEL: Record<string, { label: string; severity: AlertSeverity }> = {
  yellow: { label: "amarelo", severity: "ATENCAO" },
  orange: { label: "laranja", severity: "IMPORTANTE" },
  red: { label: "vermelho", severity: "CRITICO" },
};

/** O IPMA emite por distrito: Torres Vedras pertence ao distrito de Lisboa, código LSB. */
export function parseIpmaWarnings(warnings: IpmaWarning[]): AlertRecord[] {
  return warnings.flatMap((warning) => {
    const level = IPMA_LEVEL[warning.awarenessLevelID];
    if (warning.idAreaAviso !== "LSB" || !level) return [];
    const startsAt = new Date(`${warning.startTime}Z`);
    const endsAt = new Date(`${warning.endTime}Z`);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return [];
    return [{
      kind: "alert" as const,
      key: `ipma|${warning.awarenessTypeName}|${warning.awarenessLevelID}|${warning.startTime}`,
      title: `Aviso ${level.label} do IPMA: ${warning.awarenessTypeName}`,
      type: "METEOROLOGIA" as const,
      severity: level.severity,
      description: cleanText(warning.text) || `Aviso meteorológico ${level.label} para o distrito de Lisboa. O IPMA não publicou texto adicional.`,
      startsAt,
      endsAt,
      hasOfficialEnd: true,
      hasTime: true,
      area: "Distrito de Lisboa, que inclui o concelho de Torres Vedras",
      areaType: "CONCELHO" as const,
      publishedAt: startsAt,
      sourceUrl: IPMA_PAGE,
    }];
  });
}

// ---------- Câmara Municipal ----------

const CM = "https://www.cm-tvedras.pt";

export function parseCmNoticeList(html: string): { url: string; title: string; published: Date | null }[] {
  const $ = cheerio.load(html);
  return $(".articles-list-item").toArray().flatMap((element) => {
    const item = $(element);
    const href = item.find("article a[href]").first().attr("href");
    const title = cleanText(item.find("h3").first().text());
    if (!href || !title) return [];
    return [{ url: new URL(href, CM).href, title, published: parsePublishedDate(item.find(".articles-list-item__date").text()) }];
  });
}

export function parseCmNoticeDetail(html: string, item: { url: string; title: string; published: Date | null }, now: Date): AlertRecord {
  const $ = cheerio.load(html);
  const description = cleanText($(".articles-description").first().text());
  return buildNotice({ ...item, description: description || item.title, now });
}

/** Os PDF estão excluídos pelo robots.txt: lê-se só o título, a data e a ligação, na página pública. */
export function parseCmCivilProtection(html: string, pageUrl: string): AlertRecord[] {
  const $ = cheerio.load(html);
  return $('a[href*="prociv-comunicados"]').toArray().flatMap((element) => {
    const text = cleanText($(element).text());
    const match = text.match(/^(.+?)\s*-\s*(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return [];
    const published = utc(Number(match[2]), Number(match[3]) - 1, Number(match[4]));
    const url = new URL($(element).attr("href") ?? "", pageUrl).href;
    return [{
      kind: "alert" as const,
      key: url,
      title: match[1],
      type: "PROTECAO_CIVIL" as const,
      severity: "ATENCAO" as const,
      description: "Comunicado publicado pela Proteção Civil Municipal de Torres Vedras. Consulte o documento oficial.",
      startsAt: published,
      endsAt: new Date(published.getTime() + CIVIL_PROTECTION_ACTIVE_DAYS * DAY_MS),
      hasOfficialEnd: false,
      hasTime: false,
      area: CONCELHO,
      areaType: "CONCELHO" as const,
      publishedAt: published,
      sourceUrl: url,
    }];
  });
}

// ---------- SMAS ----------

export const SMAS = "https://www.smastv.pt";

export function parseSmasList(html: string): string[] {
  const $ = cheerio.load(html);
  const links = $('a[href*="/anuncio/"]').toArray().map((element) => new URL($(element).attr("href") ?? "", SMAS).href);
  return [...new Set(links)];
}

export function parseSmasDetail(html: string, url: string, now: Date): AlertRecord | null {
  const $ = cheerio.load(html);
  $("script, style, nav, header, footer").remove();
  // O início da página traz o aviso de cookies e o título do site.
  const text = cleanText($("body").text()).replace(/^.*voltar ao topo da página\s*/i, "");
  const match = text.match(/^(.*?)\s*Ouvir\s*(\d{1,2}\s+[A-Za-zçÇ]+\s+\d{4})\s*(.*?)(?:\s*Voltar\s+Partilhar|$)/);
  if (!match) return null;
  return buildNotice({ url, title: match[1], description: match[3], published: parsePublishedDate(match[2]), now });
}
