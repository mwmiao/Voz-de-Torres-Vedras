import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Agreement, GeoPrecision, IncidentCategory, IncidentPhase, SourceTier } from "@prisma/client";
import { classifySourceTier, type AccountEntry } from "@/lib/source-tiers";
import { type IncidentPlace, type IngestRecord } from "../types";
import { assertContains, assertMinimum } from "../validators";
import { assembleIncident, buildIncident, concelhoPlace, firstSentence, looksLikeIncident, type ArticleInput, freguesiaPlace, localidadePlace, mentionsConcelho } from "../parsers/ocorrencias";
import { GNR_LIST, parseGnrDetail, parseGnrList } from "../parsers/gnr";
import { NAM_SITEMAP, parseNamArticle, parseNewsSitemap } from "../parsers/noticias-ao-minuto";
import { parseRssFeed } from "../parsers/noticias-rss";
import { parseMastodonStatuses, parseTelegramChannel, type MastodonStatus, type SocialPost } from "../parsers/redes-sociais";
import { CONCELHO, PRECISION_RADIUS_M, windowStart } from "@/lib/incidents";
import type { Collector, CollectorInput } from "./types";

// ---------- Ocorrências recentes ----------

/** Só se lê o que pode ainda entrar no mapa: um dia de margem para notícias publicadas mais tarde. */
const recent = (date: Date | null, now: Date) => date !== null && date.getTime() >= windowStart(now).getTime() - 86_400_000;

/** Artigo ou publicação de uma origem, já com a fonte; o texto pode só chegar ao abrir. */
type ArticleStub = Omit<ArticleInput, "now" | "text" | "concelhoImplied"> & {
  text?: string;
  /** Etiquetas da origem, usadas no pré-filtro: «GNR» numa autoridade deixa passar tudo. */
  categories?: string[];
  /** Texto do pré-filtro, quando não é o título: numa publicação sem título, o texto inteiro. */
  hint?: string;
};

/** Como uma origem lista os seus artigos e, se for preciso, abre cada um. */
type ArticleAdapter = {
  list: (input: CollectorInput) => Promise<ArticleStub[]>;
  /** Abre o artigo só depois do pré-filtro, para não pedir páginas sem interesse. */
  open?: (input: CollectorInput, stub: ArticleStub) => Promise<Partial<ArticleStub>>;
  /** A origem só publica sobre Torres Vedras: a menção ao concelho é implícita. */
  concelhoImplied?: boolean;
  /** Trabalho depois da recolha, com os URL que passaram o pré-filtro. */
  after?: (input: CollectorInput, listed: Set<string>) => Promise<IngestRecord[]>;
};

/**
 * Recolha comum a todas as origens de artigos e publicações: janela de 14 dias, um artigo uma vez,
 * pré-filtro pelo título ou pelas etiquetas, menção ao concelho, montagem do relato e contagens.
 */
function articleCollector(adapter: ArticleAdapter): Collector {
  return async (input) => {
    const records: IngestRecord[] = [];
    const stats = { found: 0, considered: 0 };
    const seen = new Set<string>();
    const listed = new Set<string>();
    for (const stub of await adapter.list(input)) {
      if (seen.has(stub.url) || !recent(stub.published, input.now)) continue;
      seen.add(stub.url);
      stats.found += 1;
      if (!looksLikeIncident(stub.hint ?? stub.title, stub.categories)) continue;
      listed.add(stub.url);
      const article = adapter.open ? { ...stub, ...(await adapter.open(input, stub)) } : stub;
      const text = article.text ?? "";
      if (!adapter.concelhoImplied && !mentionsConcelho(`${article.title} ${text}`)) continue;
      stats.considered += 1;
      records.push(buildIncident({ ...article, text, concelhoImplied: adapter.concelhoImplied, now: input.now }));
    }
    if (adapter.after) records.push(...(await adapter.after(input, listed)));
    return { records, stats };
  };
}

export const collectGnr = articleCollector({
  list: async (input) => {
    const { body } = await input.http.text(GNR_LIST);
    // A GNR é a autoridade: todos os comunicados recentes passam o pré-filtro e são abertos.
    return assertMinimum(parseGnrList(body), 5, "comunicados da GNR").map((item) => ({ ...item, sourceName: "GNR", sourceTier: "OFICIAL" as const, author: "Guarda Nacional Republicana", categories: ["GNR"] }));
  },
  open: async (input, stub) => {
    const detail = parseGnrDetail((await input.http.text(stub.url)).body);
    return { title: detail.title || stub.title, text: detail.text, published: detail.published ?? stub.published };
  },
});

export const collectNoticiasAoMinuto = articleCollector({
  list: async (input) => {
    const { body } = await input.http.text(NAM_SITEMAP);
    assertContains(body, /news:publication_date/, "sitemap de notícias");
    return parseNewsSitemap(body).map((item) => ({ ...item, sourceName: "Notícias ao Minuto", sourceTier: "IMPRENSA" as const }));
  },
  open: async (input, stub) => {
    const article = parseNamArticle((await input.http.text(stub.url)).body);
    return { title: article.title || stub.title, text: article.text, published: article.published ?? stub.published, author: article.author };
  },
});

type NewsFeed = {
  feedUrl: string;
  sourceName: string;
  /** Páginas do feed a ler, no máximo: pára antes se os artigos já estiverem fora da janela. */
  maxPages: number;
  /** Feed de uma categoria só de Torres Vedras. */
  concelhoImplied?: boolean;
};

/**
 * Notícias de um feed RSS. O texto do feed serve só para extrair data, área e tipo; nunca é guardado.
 * Lê o feed até sair da janela de 14 dias, sem cache condicional: uma primeira página igual não diz
 * nada sobre as seguintes. Os artigos não são abertos, e os já registados ficam inalterados.
 */
export function newsFeedCollector(feed: NewsFeed): Collector {
  return articleCollector({
    concelhoImplied: feed.concelhoImplied,
    list: async (input) => {
      const stubs: ArticleStub[] = [];
      for (let page = 1; page <= feed.maxPages; page += 1) {
        const url = page === 1 ? feed.feedUrl : `${feed.feedUrl}?paged=${page}`;
        const { body } = await input.http.text(url);
        if (page === 1) assertContains(body, /<rss[\s>]/, `feed de ${feed.sourceName}`);
        const items = parseRssFeed(body);
        // No WordPress, a primeira categoria é a secção; as restantes são etiquetas.
        stubs.push(...items.map((item) => ({ ...item, sourceName: feed.sourceName, sourceTier: "IMPRENSA" as const, articleCategory: item.categories[0] ?? null })));
        const oldest = items.at(-1)?.published;
        if (items.length === 0 || !recent(oldest ?? null, input.now)) break;
      }
      return stubs;
    },
  });
}

type CommunityConfig = { contas: AccountEntry[]; mastodon: { instancia: string; etiquetas: string[] }; telegram: string[] };

/** Contas conhecidas e canais a seguir, em prisma/data/fontes-comunitarias.json. */
function readCommunityConfig(): CommunityConfig {
  const file = path.join(process.cwd(), "prisma", "data", "fontes-comunitarias.json");
  const fallback: CommunityConfig = { contas: [], mastodon: { instancia: "https://masto.pt", etiquetas: [] }, telegram: [] };
  return existsSync(file) ? { ...fallback, ...(JSON.parse(readFileSync(file, "utf8")) as Partial<CommunityConfig>) } : fallback;
}

/** Publicação em rede social: o nível vem do registo de contas; sem registo, é fonte comunitária. */
function socialStub(post: SocialPost, platform: string, config: CommunityConfig): ArticleStub {
  const account = { platform, handle: post.handle };
  const known = config.contas.find((entry) => entry.platform === platform && entry.handle.toLowerCase() === post.handle.toLowerCase());
  return {
    url: post.url,
    title: firstSentence(post.text),
    text: post.text,
    hint: post.text,
    published: post.published,
    // Contas pessoais não são identificadas no registo público.
    sourceName: known?.name ?? (platform === "telegram" ? "Canal público de Telegram" : "Publicação no Mastodon"),
    sourceTier: classifySourceTier(post.url, account, config.contas),
    account,
    engagement: post.engagement,
  };
}

export const collectMastodon = articleCollector({
  list: async (input) => {
    const config = readCommunityConfig();
    const stubs: ArticleStub[] = [];
    for (const tag of config.mastodon.etiquetas) {
      const { data } = await input.http.json<MastodonStatus[]>(`${config.mastodon.instancia}/api/v1/timelines/tag/${encodeURIComponent(tag)}?limit=40`);
      stubs.push(...parseMastodonStatuses(data).map((post) => socialStub(post, "mastodon", config)));
    }
    return stubs;
  },
  // Volta a ver as publicações já registadas: apagadas ou editadas a fundo descem de estado ou são arquivadas.
  after: async (input, listed) => {
    const config = readCommunityConfig();
    const records: IngestRecord[] = [];
    const tracked = await input.db.incident.findMany({ where: { sourceId: "mastodon-torresvedras", archivedAt: null, sourceRemovedAt: null }, select: { key: true } });
    for (const { key } of tracked.filter((item) => !listed.has(item.key))) {
      const id = key.match(/\/(\d+)$/)?.[1];
      if (!id) continue;
      try {
        const { data } = await input.http.json<MastodonStatus>(`${config.mastodon.instancia}/api/v1/statuses/${id}`);
        const [post] = parseMastodonStatuses([data]);
        if (post) records.push(buildIncident({ ...socialStub(post, "mastodon", config), text: post.text, now: input.now }));
      } catch (error) {
        if (error instanceof Error && /\(404\)|\(410\)/.test(error.message)) records.push({ kind: "incident-removed", sourceUrl: key });
        else throw error;
      }
    }
    return records;
  },
});

export const collectTelegram = articleCollector({
  list: async (input) => {
    const config = readCommunityConfig();
    const stubs: ArticleStub[] = [];
    for (const channel of config.telegram) {
      const { body } = await input.http.text(`https://t.me/s/${encodeURIComponent(channel)}`);
      stubs.push(...parseTelegramChannel(body, channel).map((post) => socialStub(post, "telegram", config)));
    }
    return stubs;
  },
});

type CuratedIncident = {
  sourceUrl: string;
  sourceName: string;
  /** Sem nível, é calculado pelo endereço e pela conta. */
  sourceTier?: SourceTier;
  account?: { platform: string; handle: string };
  author?: string;
  /** Secção do artigo na fonte, como «Justiça». */
  articleCategory?: string;
  /** Título original: só serve para comparar com outras fontes, nunca é guardado nem mostrado. */
  title?: string;
  publishedAt: string;
  /** Sem data na fonte, omita: fica a data de publicação. */
  incidentStart?: string;
  incidentEnd?: string;
  hasTime?: boolean;
  category: IncidentCategory;
  tags?: string[];
  /** Slug da freguesia, ou «concelho» quando a fonte só indica o concelho (só níveis 1 e 2). */
  freguesia: string;
  /** Nome de uma localidade conhecida ou de uma área pública nomeada por fonte fiável. */
  placeName?: string;
  precision?: GeoPrecision;
  latitude?: number;
  longitude?: number;
  radiusM?: number;
  phase?: IncidentPhase;
  /** Ligação a uma ocorrência existente, pelo URL da sua primeira fonte. */
  incidentKey?: string;
  agreement?: Agreement;
  /** Quem registou indicou que a publicação contém dados pessoais: a ligação não é publicada. */
  personalData?: boolean;
  removed?: boolean;
  engagement?: number;
};

/** Lugar de um registo à mão: concelho, localidade conhecida, zona com ponto próprio, ou freguesia. */
function curatedPlace(item: CuratedIncident): IncidentPlace | null {
  if (item.freguesia === CONCELHO) return concelhoPlace();
  const freguesia = freguesiaPlace(item.freguesia);
  if (item.precision === "LOCALIDADE" && item.placeName) return localidadePlace(item.placeName) ?? freguesia;
  const { precision, placeName, latitude, longitude } = item;
  if ((precision === "AREA_PUBLICA" || precision === "ZONA_APROXIMADA") && freguesia && placeName && latitude !== undefined && longitude !== undefined) {
    return { freguesiaSlug: freguesia.freguesiaSlug, placeName, precision, latitude, longitude, radiusM: item.radiusM ?? PRECISION_RADIUS_M[precision] };
  }
  return freguesia;
}

/** Ocorrências registadas por uma pessoa: dão os factos diretamente e passam pela mesma montagem dos artigos. */
export const collectCuratedIncidents: Collector = async ({ now }) => {
  const file = path.join(process.cwd(), "prisma", "data", "ocorrencias-curadas.json");
  if (!existsSync(file)) return { records: [] };
  const config = readCommunityConfig();
  const items = JSON.parse(readFileSync(file, "utf8")) as CuratedIncident[];
  const date = (value?: string) => (value ? new Date(value) : null);
  return {
    records: items.map((item): IngestRecord => {
      if (item.removed) return { kind: "incident-removed", sourceUrl: item.sourceUrl };
      const publishedAt = date(item.publishedAt);
      const place = curatedPlace(item);
      if (!publishedAt) return { kind: "incident-rejected", sourceUrl: item.sourceUrl, reason: "sem data de publicação" };
      if (!place) return { kind: "incident-rejected", sourceUrl: item.sourceUrl, reason: `freguesia desconhecida: ${item.freguesia}` };
      const source = { ...item, url: item.sourceUrl, publishedAt, sourceTier: item.sourceTier ?? classifySourceTier(item.sourceUrl, item.account, config.contas) };
      return assembleIncident(
        source,
        {
          category: item.category,
          tags: item.tags ?? [],
          place,
          incidentStart: date(item.incidentStart),
          incidentEnd: date(item.incidentEnd),
          hasTime: item.hasTime ?? false,
          phase: item.phase ?? null,
          flags: [],
          doubts: [],
          denies: item.agreement === "CONTRADIZ",
          personalData: item.personalData ? ["indicados por quem registou"] : [],
          // O título só serve para a impressão digital: não é guardado.
          fingerprint: item.title ? { title: item.title, full: item.title } : undefined,
        },
        now,
      );
    }),
  };
};
