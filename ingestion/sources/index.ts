import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import * as cheerio from "cheerio";
import { extractText, getDocumentProxy } from "unpdf";
import { MUNICIPAL_NIFS, normalizeBaseRecord, type BaseRecord } from "@/lib/import/base";
import { filterJsonArray, findYearResource, unzipFirst } from "../fetchers/open-data";
import { sha256, type PoliteHttp } from "../fetchers/http";
import { wpList } from "../fetchers/wordpress";
import { cleanText } from "../normalizers";
import { parseEditalPage, parseFinance, parseMedia, type WpMedia, type WpPage } from "../parsers/assembleia";
import { parseAnnouncements, parseModifications, type RawAnnouncement, type RawModification } from "../parsers/base";
import {
  editalToDocument,
  isMeetingEdital,
  parseAtasIndex,
  parseComposicao,
  parseContratacao,
  parseEditaisIndex,
  parseEditalMeeting,
  parseGestao,
  parseRegulamentos,
} from "../parsers/camara";
import { StructureError, type AlertRecord, type Collected, type IngestRecord } from "../types";
import { assertContains, assertMinimum } from "../validators";
import {
  DEFAULT_ACTIVE_DAYS,
  IPMA_API,
  parseCmCivilProtection,
  parseCmNoticeDetail,
  parseCmNoticeList,
  parseIpmaWarnings,
  parseSmasDetail,
  parseSmasList,
  SMAS,
  type IpmaWarning,
} from "../parsers/alertas";
import { CRIME_CATEGORIES, INE_SERIES, ineRows, ineUrl, parseCrimeYear, parsePopulation, type IneResponse } from "../parsers/ine";

export type CollectorInput = { http: PoliteHttp; db: PrismaClient; revision: string | null; now: Date };
export type Collector = (input: CollectorInput) => Promise<Collected>;

const AM_API = "https://www.am-tvedras.pt/wp-json/wp/v2";
/** Limite do arquivo recolhido. O seed inclui o que foi transcrito antes desta data. */
const SINCE = "2025-01-01T00:00:00";
const CM = "https://www.cm-tvedras.pt";

const slugBase = (kind: string) => (year: number) => `contratos-publicos-portal-base-impic-${kind}-de-2012-a-${year}`;

/** Página simples: só volta a interpretar se o conteúdo mudou. */
async function page(input: CollectorInput, url: string): Promise<string | null> {
  const { body, notModified } = await input.http.text(url, { cache: true });
  return notModified ? null : body;
}

const collectAmDocumentos: Collector = async ({ http }) => {
  const items = await wpList<WpMedia>(http, `${AM_API}/media`, {
    mime_type: "application/pdf",
    after: SINCE,
    orderby: "date",
    order: "desc",
    _fields: "date,title,source_url",
  });
  return { records: assertMinimum(parseMedia(items), 50, "documentos da Assembleia"), complete: true };
};

const collectAmEditais: Collector = async ({ http }) => {
  const pages = await wpList<WpPage>(http, `${AM_API}/pages`, {
    search: "Edital",
    after: SINCE,
    orderby: "date",
    order: "desc",
    _fields: "date,link,title,content",
  });
  const editais = pages.filter((item) => /edital/i.test(item.title.rendered));
  assertMinimum(editais, 5, "editais da Assembleia");
  const records: IngestRecord[] = [];
  for (const item of editais) {
    const { document, meeting } = parseEditalPage(item);
    records.push(document);
    if (meeting) records.push(meeting);
  }
  return { records };
};

const collectFinance: Collector = async ({ http, db, now }) => {
  const items = await wpList<WpMedia>(http, `${AM_API}/media`, {
    mime_type: "application/pdf",
    search: "Informacao Presidente",
    after: `${now.getUTCFullYear() - 1}-01-01T00:00:00`,
    orderby: "date",
    order: "desc",
    _fields: "date,title,source_url",
  });
  const candidates = parseMedia(items).filter((item) => /informa[çc][ãa]o/i.test(`${item.title} ${item.url}`));
  const records: IngestRecord[] = [];
  for (const document of candidates) {
    const known = await db.source.findUnique({ where: { url: document.url }, select: { data: true } });
    if ((known?.data as { financeParsed?: boolean } | null)?.financeParsed) continue;
    const bytes = await http.bytes(document.url);
    const { text } = await extractText(await getDocumentProxy(bytes), { mergePages: true });
    const finance = parseFinance(text, document.url);
    // Nem todas as informações trazem o mapa completo: estas ficam só como documento.
    records.push({ ...document, data: { financeParsed: true, temSituacaoFinanceira: Boolean(finance) } });
    if (finance) records.push(...finance);
  }
  return { records };
};

const collectAmComposicao: Collector = async (input) => {
  const records: IngestRecord[] = [];
  for (const [url, title, marker] of [
    ["https://www.am-tvedras.pt/composicao26/", "Composição 2026-2029", /deputados municipais/i],
    ["https://www.am-tvedras.pt/comissoes/", "Comissões", /comiss[ãa]o permanente/i],
  ] as const) {
    const { body } = await input.http.text(url);
    const $ = cheerio.load(body);
    $("script, style").remove();
    const text = cleanText($("body").text());
    assertContains(text, marker, title);
    records.push({
      kind: "document",
      url,
      title,
      publisher: "Assembleia Municipal de Torres Vedras",
      docType: "PAGINA_OFICIAL",
      category: "ELEITO",
      data: { conteudo: sha256(text) },
    });
  }
  return { records };
};

async function collectBaseYearly<T>(
  input: CollectorInput,
  kind: string,
  file: (year: number) => RegExp,
  transform: (rows: T[]) => Promise<IngestRecord[]> | IngestRecord[],
  terms: string[],
): Promise<Collected> {
  const resource = await findYearResource(input.http, slugBase(kind), file, input.now);
  const revision = `${resource.url}|${resource.last_modified}`;
  if (revision === input.revision) return { unchanged: true };
  let bytes = await input.http.bytes(resource.url, { api: true });
  if (resource.title.endsWith(".zip")) bytes = unzipFirst(bytes);
  const rows = [...filterJsonArray<T>(bytes, terms)];
  return { records: await transform(rows), revision };
}

/** Anos anteriores permitem comparar contratos de um ano para o outro. */
const FIRST_CONTRACT_YEAR = 2023;

const collectContratos: Collector = async (input) => {
  const revisions = parseRevisions(input.revision);
  const records = new Map<string, IngestRecord>();
  const { data } = await input.http.json<{ resources: { title: string; url: string; last_modified: string }[] }>(
    `https://dados.gov.pt/api/1/datasets/${slugBase("contratos")(input.now.getUTCFullYear())}/`,
  );
  for (let year = FIRST_CONTRACT_YEAR; year <= input.now.getUTCFullYear(); year += 1) {
    const resource = data.resources.find((item) => new RegExp(`^contratos${year}\\.zip$`, "i").test(item.title));
    if (!resource) continue;
    if (revisions[year] === resource.last_modified) continue;
    // Um ano de cada vez, para libertar a memória do ficheiro anterior.
    const rows = [...filterJsonArray<BaseRecord>(unzipFirst(await input.http.bytes(resource.url, { api: true })), MUNICIPAL_NIFS)];
    for (const row of rows) {
      const contract = normalizeBaseRecord(row);
      if (contract) records.set(contract.baseId, { kind: "contract", ...contract });
    }
    revisions[year] = resource.last_modified;
  }
  if (records.size === 0) return { unchanged: true };
  return { records: [...records.values()], revision: JSON.stringify(revisions) };
};

function parseRevisions(revision: string | null): Record<number, string> {
  try {
    const parsed = JSON.parse(revision ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

const collectAnuncios: Collector = (input) =>
  collectBaseYearly<RawAnnouncement>(
    input,
    "anuncios",
    (year) => new RegExp(`^anuncios${year}\\.json$`, "i"),
    (rows) => parseAnnouncements(rows),
    MUNICIPAL_NIFS,
  );

const collectModificacoes: Collector = (input) =>
  collectBaseYearly<RawModification>(
    input,
    "modificacoes-contratuais",
    (year) => new RegExp(`^modcontrats${year}\\.json$`, "i"),
    async (rows) => {
      const contracts = await input.db.contract.findMany({ select: { baseId: true } });
      return parseModifications(rows, new Set(contracts.map((contract) => contract.baseId)));
    },
    ['"idcontrato"'],
  );

const collectCmEditais: Collector = async (input) => {
  const url = `${CM}/documentos/editaisatas/editaiscm`;
  const html = await page(input, url);
  if (html === null) return { unchanged: true };
  const editais = assertMinimum(parseEditaisIndex(html, url), 100, "editais da Câmara");
  const records: IngestRecord[] = [];
  const currentYear = input.now.getUTCFullYear();
  for (const edital of editais.filter((item) => item.year >= 2025)) {
    records.push(editalToDocument(edital));
    if (edital.year < currentYear || !isMeetingEdital(edital.title)) continue;
    // Só se abre o edital de convocação uma vez: o seu conteúdo não muda.
    const known = await input.db.source.findUnique({ where: { url: edital.url }, select: { contentHash: true } });
    if (known?.contentHash) continue;
    const { body } = await input.http.text(edital.url);
    const meeting = parseEditalMeeting(body, edital.url, edital.title);
    if (meeting) records.push(meeting);
  }
  return { records };
};

const collectCmAtas: Collector = async (input) => {
  const url = `${CM}/documentos/editaisatas/atascm`;
  const html = await page(input, url);
  if (html === null) return { unchanged: true };
  const { documents, meetings } = parseAtasIndex(html, url);
  assertMinimum(documents, 50, "atas da Câmara");
  return { records: [...documents, ...meetings] };
};

const simple =
  (url: string, parse: (html: string, pageUrl: string) => IngestRecord[], minimum: number, what: string): Collector =>
  async (input) => {
    const html = await page(input, url);
    if (html === null) return { unchanged: true };
    return { records: assertMinimum(parse(html, url), minimum, what) };
  };

const collectCmComposicao: Collector = async (input) => {
  const url = `${CM}/o/composicaocm`;
  const { body } = await input.http.text(url);
  const officials = assertMinimum(parseComposicao(body, url), 7, "eleitos do Executivo");
  return { records: officials, complete: true };
};

async function ineData(input: CollectorInput, code: string, year: number, area: string, extra = "") {
  const { data } = await input.http.json<IneResponse[]>(ineUrl(code, year, area, extra));
  return ineRows(data, year);
}

const collectIneCrime: Collector = async (input) => {
  const records: IngestRecord[] = [];
  const lastYear = input.now.getUTCFullYear() - 1;
  for (let year = 2011; year <= lastYear; year += 1) {
    const counts = INE_SERIES.counts.find((item) => year >= item.from && year <= item.to)!;
    const rates = INE_SERIES.rates.find((item) => year >= item.from && year <= item.to)!;
    const population = INE_SERIES.population.find((item) => year >= item.from && year <= item.to)!;
    try {
      const count = await ineData(input, counts.code, year, counts.area);
      const rate = await ineData(input, rates.code, year, rates.area);
      records.push(...parseCrimeYear({ year, counts: count.rows, rates: rate.rows, countIndicator: counts.code, publishedAt: count.updated }));
    } catch (error) {
      // O ano mais recente pode ainda não estar publicado.
      if (year < lastYear) throw error;
      continue;
    }
    const residents = await ineData(input, population.code, year, population.area, "&Dim3=T&Dim4=T").catch(() => null);
    const estimate = residents && parsePopulation(residents.rows, year, population.code, residents.updated);
    if (estimate) records.push(estimate);
  }
  const totals = records.filter((record) => record.kind === "crime" && record.categoryCode === "T");
  assertMinimum(totals, 10, `anos de dados de ${CRIME_CATEGORIES[0].name.toLowerCase()}`);
  return { records };
};

const collectIpma: Collector = async ({ http }) => {
  const { data } = await http.json<IpmaWarning[]>(IPMA_API);
  assertMinimum(data, 1, "avisos do IPMA");
  return { records: parseIpmaWarnings(data), complete: true };
};

const collectCmAvisos: Collector = async (input) => {
  const url = `${CM}/artigos/avisos/`;
  const { body } = await input.http.text(url);
  const list = assertMinimum(parseCmNoticeList(body), 3, "avisos da Câmara");
  const records: IngestRecord[] = [];
  for (const item of list) {
    // Volta a abrir-se cada aviso da lista, porque a Câmara atualiza alguns, como os de trânsito.
    const { body: detail } = await input.http.text(item.url);
    records.push(parseCmNoticeDetail(detail, item, input.now));
  }
  return { records };
};

const collectCmProciv: Collector = async (input) => {
  const url = `${CM}/outros/prociv/avisos/`;
  const { body } = await input.http.text(url);
  const year = input.now.getUTCFullYear() - 1;
  const records = assertMinimum(parseCmCivilProtection(body, url), 3, "comunicados da Proteção Civil");
  return { records: records.filter((record) => (record.publishedAt?.getUTCFullYear() ?? 0) >= year) };
};

const collectSmas: Collector = async (input) => {
  const records: IngestRecord[] = [];
  for (const section of ["interrupcoes-programadas", "avisos-de-falha-de-abastecimento", "outros-avisos"]) {
    const { body } = await input.http.text(`${SMAS}/cliente/avisos-e-interrupcoes/${section}`);
    assertContains(body, /An[úu]ncios/, "avisos dos SMAS");
    for (const url of parseSmasList(body)) {
      const { body: detail } = await input.http.text(url);
      const record = parseSmasDetail(detail, url, input.now);
      if (!record) throw new StructureError(`aviso dos SMAS sem o formato esperado: ${url}`);
      records.push(record);
    }
  }
  return { records };
};

const collectCurated: Collector = async ({ now }) => {
  const file = path.join(process.cwd(), "prisma", "data", "alertas-curados.json");
  if (!existsSync(file)) return { records: [] };
  const items = JSON.parse(readFileSync(file, "utf8")) as (Omit<AlertRecord, "kind" | "key" | "startsAt" | "endsAt" | "publishedAt" | "hasTime" | "hasOfficialEnd" | "areaType"> & { startsAt?: string; endsAt?: string; publishedAt?: string })[];
  const date = (value?: string) => (value ? new Date(value) : null);
  return {
    records: items.map((item) => ({
      ...item,
      kind: "alert" as const,
      key: `curado|${item.sourceUrl}`,
      startsAt: date(item.startsAt),
      endsAt: date(item.endsAt) ?? new Date(now.getTime() + DEFAULT_ACTIVE_DAYS * 86_400_000),
      hasOfficialEnd: Boolean(item.endsAt),
      hasTime: false,
      areaType: item.area.startsWith("Concelho") ? ("CONCELHO" as const) : ("FREGUESIA" as const),
      publishedAt: date(item.publishedAt),
    })),
  };
};

export const COLLECTORS: Record<string, Collector> = {
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
