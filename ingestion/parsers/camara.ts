import * as cheerio from "cheerio";
import {
  canonicalUrl,
  cleanPortfolio,
  cleanText,
  dateFromPath,
  lisbonDate,
  MONTH_PATTERN,
  monthNumber,
  officialParty,
  officialRole,
  utcDate,
} from "../normalizers";
import type { DocumentRecord, MeetingRecord, OfficialRecord } from "../types";

const PUBLISHER = "Câmara Municipal de Torres Vedras";

export type EditalLink = { number: string; year: number; title: string; url: string };

export function parseEditaisIndex(html: string, pageUrl: string): EditalLink[] {
  const $ = cheerio.load(html);
  const editais: EditalLink[] = [];
  $('a[href^="?id="]').each((_, element) => {
    const title = cleanText($(element).text());
    const match = /^Edital N\.º\s*(\d+)\/(\d{4})/i.exec(title);
    const url = canonicalUrl($(element).attr("href") ?? "", pageUrl);
    if (match && url) editais.push({ number: match[1], year: Number(match[2]), title, url });
  });
  return editais;
}

export function editalToDocument(edital: EditalLink): DocumentRecord {
  return {
    kind: "document",
    url: edital.url,
    title: edital.title,
    publisher: PUBLISHER,
    docType: "EDITAL",
    category: /reuni[ãa]o/i.test(edital.title) ? "REUNIAO" : "DOCUMENTO",
    data: { numero: `${edital.number}/${edital.year}` },
  };
}

export function isMeetingEdital(title: string): boolean {
  return /reuni[ãa]o (p[úu]blica|extraordin[áa]ria|ordin[áa]ria)/i.test(title);
}

/** Lê a data, a hora e o local do texto de um edital de convocação. */
export function parseEditalMeeting(html: string, url: string, title: string): MeetingRecord | null {
  const $ = cheerio.load(html);
  const text = cleanText($(".paginaDetail").first().text());
  const pattern = new RegExp(`no dia (\\d{1,2}) de ${MONTH_PATTERN} de (\\d{4})[^.]*?pelas (\\d{1,2})h(\\d{2})?m?,?\\s*(?:(?:no|na|nas|nos) (.+?)(?:, na qual|, com a seguinte|\\.|;))?`, "i");
  const match = pattern.exec(text);
  if (!match) return null;
  const [, day, month, year, hour, minute, location] = match;
  return {
    kind: "meeting",
    body: "EXECUTIVO_MUNICIPAL",
    date: lisbonDate(Number(year), monthNumber(month), Number(day), Number(hour), Number(minute ?? 0)),
    hasTime: true,
    title: cleanText(title.replace(/^Edital N\.º\s*\d+\/\d{4}\s*[-–]\s*/i, "")),
    location: location ? cleanText(location) : null,
    sourceUrl: url,
  };
}

export function parseAtasIndex(html: string, pageUrl: string): { documents: DocumentRecord[]; meetings: MeetingRecord[] } {
  const $ = cheerio.load(html);
  const documents: DocumentRecord[] = [];
  const meetings: MeetingRecord[] = [];
  $('.ataseditais-list a[href$=".pdf"]').each((_, element) => {
    const label = cleanText($(element).text());
    const url = canonicalUrl($(element).attr("href") ?? "", pageUrl);
    if (!url || !label) return;
    const draft = /^Reuni[ãa]o/i.test(label);
    documents.push({
      kind: "document",
      url,
      title: draft ? `Ata em minuta: ${label}` : `Ata da Câmara Municipal: ${label}`,
      publisher: PUBLISHER,
      docType: draft ? "MINUTA" : "ATA",
      category: "REUNIAO",
      publishedAt: dateFromPath(url),
    });
    const date = new RegExp(`(\\d{1,2}) de ${MONTH_PATTERN} de (\\d{4})`, "i").exec(label);
    if (draft && date) {
      meetings.push({
        kind: "meeting",
        body: "EXECUTIVO_MUNICIPAL",
        date: utcDate(Number(date[3]), monthNumber(date[2]), Number(date[1])),
        hasTime: false,
        title: label.replace(" - ", " de "),
        location: null,
        sourceUrl: url,
      });
    }
  });
  return { documents, meetings };
}

export function parseGestao(html: string, pageUrl: string): DocumentRecord[] {
  const $ = cheerio.load(html);
  const records = new Map<string, DocumentRecord>();
  $('[id^="gestaodetail-"]').each((_, section) => {
    const year = /\d{4}/.exec($(`a[data-show-id="${$(section).attr("id")}"]`).first().text())?.[0];
    let heading = "Documentos de gestão";
    $(section)
      .find("h2, h3, a[href]")
      .each((__, element) => {
        const node = $(element);
        if (!node.is("a")) {
          heading = cleanText(node.text()) || heading;
          return;
        }
        const url = canonicalUrl(node.attr("href") ?? "", pageUrl);
        const label = cleanText(node.text());
        if (!url || !label || !/\.pdf$/i.test(new URL(url).pathname)) return;
        const published = dateFromPath(url);
        records.set(url, {
          kind: "document",
          url,
          title: `${year ? `${year}, ` : ""}${heading}: ${label}`,
          publisher: PUBLISHER,
          docType: "ORCAMENTO",
          category: "ORCAMENTO",
          publishedAt: published,
          data: { ano: year, seccao: heading },
        });
      });
  });
  return [...records.values()];
}

export function parseRegulamentos(html: string, pageUrl: string): DocumentRecord[] {
  const $ = cheerio.load(html);
  const records: DocumentRecord[] = [];
  $('.requerimentos-list a[href^="?r="]').each((_, element) => {
    const url = canonicalUrl($(element).attr("href") ?? "", pageUrl);
    const title = cleanText($(element).text());
    if (!url || !title) return;
    const section = cleanText($(element).closest("ul").parent().children("strong").first().text());
    records.push({
      kind: "document",
      url,
      title,
      publisher: PUBLISHER,
      docType: "REGULAMENTO",
      category: "DOCUMENTO",
      data: section ? { seccao: section } : undefined,
    });
  });
  return records;
}

export function parseContratacao(html: string, pageUrl: string): DocumentRecord[] {
  const $ = cheerio.load(html);
  const records = new Map<string, DocumentRecord>();
  let procedure = "";
  $(".paginaDetail")
    .find("p, a[href]")
    .each((_, element) => {
      const node = $(element);
      if (node.is("p")) {
        const strong = cleanText(node.find("strong").first().text());
        if (strong.length > 12 && cleanText(node.text()) === strong) procedure = strong;
        return;
      }
      const url = canonicalUrl(node.attr("href") ?? "", pageUrl);
      const label = cleanText(node.text());
      if (!url || !label || !procedure || !node.closest("li").length || !/\.pdf$/i.test(new URL(url).pathname)) return;
      records.set(url, {
        kind: "document",
        url,
        title: `${procedure}: ${label}`,
        publisher: PUBLISHER,
        docType: "CONCURSO",
        category: "CONTRATO",
        publishedAt: dateFromPath(url),
        data: { procedimento: procedure, documento: label },
      });
    });
  return [...records.values()];
}

export function parseComposicao(html: string, pageUrl: string): OfficialRecord[] {
  const $ = cheerio.load(html);
  const officials: OfficialRecord[] = [];
  $("article").each((_, element) => {
    const name = cleanText($(element).find("h3").first().text());
    const role = cleanText($(element).find("h4").first().text());
    if (!name || !/presidente|vereador/i.test(role)) return;
    // Sem pelouros, este parágrafo traz contactos e ligações: nunca são dados a guardar.
    const paragraph = $(element).find("p.cf").first().html() ?? "";
    const portfolios = paragraph
      .split(/<br\s*\/?>/i)
      .map((part) => cleanPortfolio(cheerio.load(part).text()))
      .filter((line) => line && !/@|biografia|^[\d\s+]+$/i.test(line));
    officials.push({
      kind: "official",
      name,
      role: officialRole(role),
      party: officialParty($(element).find("h5").first().text() || null),
      portfolios,
      sourceUrl: pageUrl,
    });
  });
  return officials;
}
