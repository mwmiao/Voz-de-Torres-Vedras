import * as cheerio from "cheerio";
import { cleanText } from "../normalizers";

/**
 * Artigo lido de um feed RSS. O texto serve só para extrair campos durante a recolha:
 * nunca é guardado nem republicado.
 */
export type FeedItem = { url: string; title: string; author: string | null; published: Date | null; categories: string[]; text: string };

/** Parâmetros de campanha e âncoras não mudam o artigo: o mesmo URL entra uma vez. */
export function canonicalArticleUrl(href: string): string | null {
  try {
    const url = new URL(href.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.protocol = "https:";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid|amp$)/.test(key)) url.searchParams.delete(key);
    if (!url.pathname.endsWith("/") && !/\.[a-z0-9]+$/i.test(url.pathname)) url.pathname += "/";
    return url.href;
  } catch {
    return null;
  }
}

const textOf = (html: string) => cleanText(cheerio.load(html).text());

/** RSS 2.0 de sites WordPress: título, ligação, autor, data, categorias e texto. */
export function parseRssFeed(xml: string): FeedItem[] {
  const $ = cheerio.load(xml, { xml: true });
  return $("item").toArray().flatMap((element) => {
    const item = $(element);
    const url = canonicalArticleUrl(item.find("link").first().text());
    const title = cleanText(item.find("title").first().text());
    if (!url || !title) return [];
    const date = new Date(item.find("pubDate").first().text().trim());
    const body = item.find("content\\:encoded").first().text() || item.find("description").first().text();
    return [{
      url,
      title,
      author: cleanText(item.find("dc\\:creator").first().text()) || null,
      published: Number.isNaN(date.getTime()) ? null : date,
      categories: item.find("category").toArray().map((category) => cleanText($(category).text())).filter(Boolean),
      text: textOf(body),
    }];
  });
}
