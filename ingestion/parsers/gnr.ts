import * as cheerio from "cheerio";
import { cleanText } from "../normalizers";

/** Comunicados de imprensa da GNR: lista pública e página de cada comunicado. */
export const GNR = "https://www.gnr.pt";
export const GNR_LIST = `${GNR}/comunicados.aspx`;

const dmy = (text: string): Date | null => {
  const match = text.match(/(\d{2})-(\d{2})-(\d{4})/);
  return match ? new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), 12)) : null;
};

export function parseGnrList(html: string): { url: string; title: string; published: Date | null }[] {
  const $ = cheerio.load(html);
  return $('a[href*="comunicado.aspx?linha="]').toArray().flatMap((element) => {
    const link = $(element);
    const title = cleanText(link.text());
    const row = link.closest("tr");
    const date = row.nextAll("tr").slice(0, 2).text();
    if (!title) return [];
    return [{ url: new URL(link.attr("href") ?? "", `${GNR}/`).href, title, published: dmy(date) }];
  });
}

export function parseGnrDetail(html: string): { title: string; text: string; published: Date | null } {
  const $ = cheerio.load(html);
  const box = $("#ctl00_Conteudo_DetalheNoticia");
  const title = cleanText(box.find("#ctl00_Conteudo_DetalheNoticia_titulo").text());
  const published = dmy(box.find("#ctl00_Conteudo_DetalheNoticia_datainicio").text());
  box.find("#ctl00_Conteudo_DetalheNoticia_titulo, [id$=datainicio], [id$=Labeldatainicio], img, script").remove();
  return { title, text: cleanText(box.text()), published };
}
