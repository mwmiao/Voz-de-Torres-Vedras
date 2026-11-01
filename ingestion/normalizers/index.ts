import type { SourceType } from "@prisma/client";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MONTH_PATTERN = `(${MONTHS.join("|")}|marco)`;

/** Dia civil guardado ao meio-dia UTC, para não mudar de data com o fuso. */
export function utcDate(year: number, month: number, day: number, hour = 12, minute = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

export function monthNumber(name: string): number {
  const key = name.toLowerCase().replace("marco", "março");
  return MONTHS.indexOf(key) + 1;
}

/** Converte a hora de Lisboa para UTC: +1 entre o último domingo de março e o de outubro. */
export function lisbonDate(year: number, month: number, day: number, hour: number, minute: number): Date {
  const lastSunday = (m: number) => {
    const last = new Date(Date.UTC(year, m, 0));
    return last.getUTCDate() - last.getUTCDay();
  };
  const start = utcDate(year, 3, lastSunday(3), 1);
  const end = utcDate(year, 10, lastSunday(10), 1);
  const candidate = utcDate(year, month, day, hour, minute);
  return candidate >= start && candidate < end ? new Date(candidate.getTime() - 3_600_000) : candidate;
}

/** URL absoluto e com https, para que o mesmo documento não entre duas vezes. */
export function canonicalUrl(href: string, base: string): string | null {
  try {
    const url = new URL(href.trim(), base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (/(^|\.)(cm-tvedras|am-tvedras)\.pt$/.test(url.hostname)) url.protocol = "https:";
    return url.href;
  } catch {
    return null;
  }
}

/** Data de publicação inscrita nos caminhos /AAAA/MM/DD/ dos ficheiros da Câmara. */
export function dateFromPath(url: string): Date | null {
  const match = /\/(20\d{2})\/(\d{2})\/(\d{2})\//.exec(url);
  return match ? utcDate(Number(match[1]), Number(match[2]), Number(match[3])) : null;
}

export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function classifyAssemblyDocument(title: string, url: string): SourceType {
  const text = `${title} ${url}`.toLowerCase();
  if (/\bata\b|\bata[-_]/.test(text)) return "ATA";
  if (/edital/.test(text)) return "EDITAL";
  return "DOCUMENTO_PDF";
}

/** Corrige confusões entre «I» e «l» maiúsculos que a fonte publica em alguns pelouros. */
export function cleanPortfolio(text: string): string {
  return cleanText(text).replace(/\blA\b/, "IA").replace(/\bldentidade\b/, "Identidade").replace(/\blnvestimento\b/, "Investimento");
}

export function officialRole(role: string): string {
  const text = cleanText(role).toLowerCase();
  if (text === "presidente") return "Presidente da Câmara";
  if (text.includes("vice-presidente")) return "Vice-Presidente";
  if (text.startsWith("vereadora")) return "Vereadora";
  if (text.startsWith("vereador")) return "Vereador";
  return cleanText(role);
}

export function officialParty(party: string | null): string | null {
  return party ? cleanText(party).replace(" - ", " — ") : null;
}
