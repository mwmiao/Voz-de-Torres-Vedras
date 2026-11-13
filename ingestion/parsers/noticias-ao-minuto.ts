import * as cheerio from "cheerio";
import { cleanText } from "../normalizers";

/** Notícias ao Minuto: sitemap de notícias e artigos, com os dados estruturados da página. */
export const NAM = "https://www.noticiasaominuto.com";
export const NAM_SITEMAP = `${NAM}/sitemap.xml`;

/** Sitemap de notícias: só a secção País, onde estão as ocorrências locais. */
export function parseNewsSitemap(xml: string): { url: string; title: string; published: Date | null }[] {
  const $ = cheerio.load(xml, { xml: true });
  return $("url").toArray().flatMap((element) => {
    const item = $(element);
    const url = item.find("loc").first().text().trim();
    if (!url.startsWith(`${NAM}/pais/`)) return [];
    const date = new Date(item.find("news\\:publication_date").text().trim());
    return [{ url, title: cleanText(item.find("news\\:title").text()), published: Number.isNaN(date.getTime()) ? null : date }];
  });
}

type LdArticle = { "@type"?: string; headline?: string; datePublished?: string; author?: { name?: string } | { name?: string }[] };

export function parseNamArticle(html: string): { title: string; text: string; published: Date | null; author: string | null } {
  const $ = cheerio.load(html);
  let article: LdArticle | undefined;
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const data = JSON.parse($(element).text()) as LdArticle | LdArticle[];
      const items = Array.isArray(data) ? data : [data];
      article ??= items.find((item) => item["@type"] === "NewsArticle");
    } catch {
      // Blocos inválidos são ignorados: os outros chegam.
    }
  });
  const paragraphs = $(".article-content p").toArray().map((element) => cleanText($(element).text())).filter((text) => text && !/^leia tamb[ée]m/i.test(text));
  const author = Array.isArray(article?.author) ? article.author[0]?.name : article?.author?.name;
  const published = article?.datePublished ? new Date(article.datePublished) : null;
  return {
    title: cleanText(article?.headline ?? $("h1").first().text()),
    text: paragraphs.join(" "),
    published: published && !Number.isNaN(published.getTime()) ? published : null,
    author: author ?? null,
  };
}
