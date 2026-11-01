import * as cheerio from "cheerio";
import { canonicalUrl, classifyAssemblyDocument, cleanText, lisbonDate, MONTH_PATTERN, monthNumber, utcDate } from "../normalizers";
import type { DocumentRecord, FinanceRecord, MeetingRecord } from "../types";

const PUBLISHER = "Assembleia Municipal de Torres Vedras";

export type WpMedia = { date: string; title: { rendered: string }; source_url: string };
export type WpPage = { date: string; link: string; title: { rendered: string }; content: { rendered: string } };

const plain = (html: string) => cleanText(cheerio.load(`<p>${html}</p>`).text());

/** Alguns ficheiros têm título vazio ou só com números: nesses casos usa-se o nome do ficheiro. */
function documentTitle(title: string, url: string): string {
  if (/\p{L}{3}/u.test(title)) return title;
  const file = decodeURIComponent(url.split("/").pop() ?? "").replace(/\.pdf$/i, "").replace(/[-_]+/g, " ");
  return /\p{L}{3}/u.test(file) ? file : `Documento da Assembleia Municipal (${title || file})`;
}

export function parseMedia(items: WpMedia[]): DocumentRecord[] {
  const records: DocumentRecord[] = [];
  for (const item of items) {
    const url = canonicalUrl(item.source_url, "https://www.am-tvedras.pt/");
    if (!url) continue;
    const docType = classifyAssemblyDocument(plain(item.title.rendered), url);
    const title = documentTitle(plain(item.title.rendered), url);
    records.push({
      kind: "document",
      url,
      title,
      publisher: PUBLISHER,
      docType,
      category: docType === "DOCUMENTO_PDF" ? "DOCUMENTO" : "REUNIAO",
      publishedAt: new Date(`${item.date}Z`),
    });
  }
  return records;
}

export function parseEditalPage(page: WpPage): { document: DocumentRecord; meeting: MeetingRecord | null } {
  const title = plain(page.title.rendered);
  const url = canonicalUrl(page.link, "https://www.am-tvedras.pt/") ?? page.link;
  const text = plain(page.content.rendered);
  const heading = text.slice(0, 200);
  const session = new RegExp(`sess[ãa]o\\s+(ordin[áa]ria|extraordin[áa]ria)\\s+(?:da assembleia municipal\\s+)?de\\s+(\\d{1,2})(?:\\s+e\\s+\\d{1,2})?\\s+de\\s+${MONTH_PATTERN}`, "i").exec(text);
  const year = Number(/\/(\d{4})/.exec(title)?.[1]);

  // O texto começa com "Edital n.º X/AAAA - assunto Download do Original ...".
  const subject = /Edital n\.º\s*\d+\/\d{4}\s*[-–—]\s*(.+?)\s*(?:Download|$)/i.exec(heading)?.[1];

  const document: DocumentRecord = {
    kind: "document",
    url,
    title: subject ? `${title}: ${subject}` : title,
    publisher: PUBLISHER,
    docType: "EDITAL",
    category: "REUNIAO",
    publishedAt: new Date(`${page.date}Z`),
  };

  if (!session || !year || /delibera/i.test(heading)) return { document, meeting: null };

  const month = monthNumber(session[3]);
  const day = Number(session[2]);
  // A sessão pode ser convocada em dezembro para janeiro.
  const time = /(?:pelas|às)\s+(\d{1,2})[.:h](\d{2})?/i.exec(text);
  const place = /\b(?:no|na)\s+((?:Sal[ãa]o|Audit[óo]rio|Edif[ií]cio|Sala|Pavilh[ãa]o)\b[^.;]{3,90}?)(?:,\s*(?:com|para|sito)\b|[.;]|\s+com a seguinte)/i.exec(text);
  return {
    document,
    meeting: {
      kind: "meeting",
      body: "ASSEMBLEIA_MUNICIPAL",
      date: time ? lisbonDate(year, month, day, Number(time[1]), Number(time[2] ?? 0)) : utcDate(year, month, day),
      hasTime: Boolean(time),
      title: `Sessão ${session[1].toLowerCase()} de ${day} de ${session[3].toLowerCase()} de ${year}`,
      location: place ? cleanText(place[1]) : null,
      sourceUrl: url,
    },
  };
}

const FINANCE_LINES: [string, RegExp][] = [
  ["Total de disponibilidades", /TOTAL DE DISPONIBILIDADES[\s_.]*([\d ]+,\d{2})\s*EUR/i],
  ["Dívida de médio e longo prazo (empréstimos e locações financeiras)", /M[ÉE]DIO E LONGO PRAZO[^_]*[\s_.]*([\d ]+,\d{2})\s*EUR/i],
  ["Dívida de curto prazo: acordos, apoios, delegação de competências e contratos-programa", /Contratos-Programa[\s_.]*([\d ]+,\d{2})\s*EUR/i],
  ["Dívida de curto prazo: outras dívidas a fornecedores e credores", /Outras d[ií]vidas a fornecedores e outros credores[\s_.]*([\d ]+,\d{2})\s*EUR/i],
  ["Limite da dívida total para 2026", /limite da d[ií]vida total para \d{4} [ée] de\s*([\d ]+,\d{2})\s*EUR/i],
  ["Dívida total da autarquia", /d[ií]vida total da autarquia a \S+ [ée] de\s*([\d ]+,\d{2})\s*EUR/i],
];

const money = (text: string) => Number(text.replace(/\s/g, "").replace(",", "."));

/** Lê a situação financeira. Devolve null se o PDF não tiver a data e as disponibilidades. */
export function parseFinance(text: string, sourceUrl: string): FinanceRecord[] | null {
  const flat = cleanText(text);
  const date = /dados [àa] data de (\d{2})\/(\d{2})\/(\d{4})/i.exec(flat);
  if (!date) return null;
  const year = Number(date[3]);
  const asOf = utcDate(year, Number(date[2]), Number(date[1]));
  const records: FinanceRecord[] = [];
  for (const [label, pattern] of FINANCE_LINES) {
    const match = pattern.exec(flat);
    if (!match) continue;
    records.push({
      kind: "finance",
      year,
      budgetKind: "SITUACAO_FINANCEIRA",
      label: label.replace("2026", String(year)),
      amountEur: money(match[1]),
      asOf,
      sourceUrl,
    });
  }
  return records.some((record) => record.label === "Total de disponibilidades") ? records : null;
}
