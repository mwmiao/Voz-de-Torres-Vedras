import * as cheerio from "cheerio";
import { cleanText } from "../normalizers";

/** Publicação pública numa rede social, já reduzida ao que a recolha precisa. */
export type SocialPost = { url: string; handle: string; text: string; published: Date | null; engagement: number };

export type MastodonStatus = {
  url: string | null;
  uri: string;
  created_at: string;
  content: string;
  visibility: string;
  reblogs_count: number;
  favourites_count: number;
  account: { acct: string };
  reblog?: MastodonStatus | null;
};

/** Só publicações públicas e originais: partilhas apontam para a publicação de origem. */
export function parseMastodonStatuses(statuses: MastodonStatus[]): SocialPost[] {
  return statuses.flatMap((status) => {
    const original = status.reblog ?? status;
    if (original.visibility !== "public") return [];
    const date = new Date(original.created_at);
    const text = cleanText(cheerio.load(original.content).text());
    if (!text) return [];
    return [{
      url: original.url ?? original.uri,
      handle: original.account.acct,
      text,
      published: Number.isNaN(date.getTime()) ? null : date,
      engagement: original.reblogs_count + original.favourites_count,
    }];
  });
}

const VIEWS = (text: string) => {
  const match = text.trim().match(/^([\d.,]+)\s*([KM])?$/i);
  if (!match) return 0;
  const value = Number(match[1].replace(",", "."));
  return Math.round(match[2]?.toUpperCase() === "M" ? value * 1_000_000 : match[2] ? value * 1000 : value);
};

/** Pré-visualização pública de um canal de Telegram (t.me/s/canal). As visualizações contam como difusão. */
export function parseTelegramChannel(html: string, channel: string): SocialPost[] {
  const $ = cheerio.load(html);
  return $(".tgme_widget_message[data-post]").toArray().flatMap((element) => {
    const item = $(element);
    const post = item.attr("data-post");
    const text = cleanText(item.find(".tgme_widget_message_text").text());
    if (!post || !text) return [];
    const date = new Date(item.find("time[datetime]").attr("datetime") ?? "");
    // Partilhas de outros canais ficam com o canal de origem.
    const forwarded = item.find(".tgme_widget_message_forwarded_from_name").attr("href")?.match(/t\.me\/([^/]+)/)?.[1];
    return [{
      url: `https://t.me/${post}`,
      handle: forwarded ?? channel,
      text,
      published: Number.isNaN(date.getTime()) ? null : date,
      engagement: Math.round(VIEWS(item.find(".tgme_widget_message_views").text()) / 100),
    }];
  });
}
