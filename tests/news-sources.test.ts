import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PoliteHttp } from "../ingestion/fetchers/http";
import { canonicalArticleUrl, parseRssFeed } from "../ingestion/parsers/noticias-rss";
import { buildIncident } from "../ingestion/parsers/ocorrencias";
import { selectSources } from "../ingestion/select";
import { COLLECTORS, newsFeedCollector, type CollectorInput } from "../ingestion/sources";
import type { IncidentRecord, IngestRecord } from "../ingestion/types";
import { filterIncidents } from "../src/lib/incidents";
import { frequencyLabel, SOURCE_CATALOG, sourceStatus } from "../src/lib/source-catalog";
import { classifySourceTier, independenceKey } from "../src/lib/source-tiers";
import { computeVerification } from "../src/lib/verification";

// Segunda-feira, 2 de novembro de 2026.
const now = new Date("2026-11-02T15:00:00Z");
const source = (id: string) => SOURCE_CATALOG.find((item) => item.id === id)!;

const item = (patch: { title: string; text: string; link?: string; creator?: string; date?: string; categories?: string[] }) => `
  <item>
    <title>${patch.title}</title>
    <link>${patch.link ?? `https://www.rtvon.pt/2026/11/02/${encodeURIComponent(patch.title.slice(0, 20))}/`}</link>
    <dc:creator><![CDATA[${patch.creator ?? "Redação"}]]></dc:creator>
    <pubDate>${patch.date ?? "Mon, 02 Nov 2026 10:00:00 +0000"}</pubDate>
    ${(patch.categories ?? ["Sociedade"]).map((category) => `<category><![CDATA[${category}]]></category>`).join("")}
    <description><![CDATA[<p>Resumo.</p>]]></description>
    <content:encoded><![CDATA[<p>${patch.text}</p>]]></content:encoded>
  </item>`;
const feed = (...items: string[]) => `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Feed</title>${items.join("")}</channel></rss>`;

/** Cliente falso: devolve o feed indicado e regista os pedidos feitos. */
function fakeInput(pages: Record<string, string>) {
  const requested: string[] = [];
  const http = {
    text: async (url: string) => {
      requested.push(url);
      return { body: pages[url] ?? feed(), hash: url, notModified: false };
    },
  };
  return { input: { http, now, revision: null, db: null } as unknown as CollectorInput, requested };
}

const incidents = (records: IngestRecord[]) => records.filter((record): record is IncidentRecord => record.kind === "incident");

describe("registo das novas fontes", () => {
  it("regista a RTV Oeste e a ON FM como imprensa ativa, com recolhedor", () => {
    for (const id of ["rtv-oeste", "onfm-torres-vedras"]) {
      expect(source(id)).toMatchObject({ enabled: true, tier: 2, group: "ocorrencias" });
      expect(source(id).coverage).toBeTruthy();
      expect(COLLECTORS[id]).toBeTypeOf("function");
      expect(sourceStatus(source(id))).toBe("ATIVA");
      expect(frequencyLabel(source(id))).toBe("A cada 3 horas");
    }
    expect(classifySourceTier("https://www.rtvon.pt/2026/11/02/x/")).toBe("IMPRENSA");
    expect(classifySourceTier("https://onfm.pt/2026/11/02/x/")).toBe("IMPRENSA");
  });

  it("deixa o JN só para registo à mão, com o motivo, e sem recolhedor", () => {
    const jn = source("jn-torres-vedras");
    expect(jn).toMatchObject({ enabled: false, manualOnly: true, tier: 2 });
    expect(jn.disabledReason).toMatch(/proíbe/);
    expect(COLLECTORS["jn-torres-vedras"]).toBeUndefined();
    expect(sourceStatus(jn)).toBe("SO_MANUAL");
    expect(classifySourceTier("https://www.jn.pt/local/x")).toBe("IMPRENSA");
  });

  it("nunca recolhe origens desativadas, só manuais ou desligadas, mesmo pedidas pelo nome", () => {
    const fake = { ...COLLECTORS, "jn-torres-vedras": async () => ({ records: [] }) };
    const ids = (options: Parameters<typeof selectSources>[2]) => selectSources(SOURCE_CATALOG, fake, options).map((item) => item.id);
    expect(ids({ only: ["jn-torres-vedras", "badaladas", "rtv-oeste"], disabled: [], alertsOnly: false })).toEqual(["rtv-oeste"]);
    expect(ids({ only: [], disabled: ["onfm-torres-vedras"], alertsOnly: true })).not.toContain("onfm-torres-vedras");
    expect(ids({ only: [], disabled: [], alertsOnly: true })).toEqual(expect.arrayContaining(["rtv-oeste", "onfm-torres-vedras"]));
  });

  it("respeita o robots.txt: um caminho excluído não é pedido", async () => {
    const asked: string[] = [];
    const fetcher = (async (url: string) => {
      asked.push(String(url));
      return new Response(String(url).endsWith("/robots.txt") ? "User-agent: *\nDisallow: /feed/" : "conteúdo", { status: 200 });
    }) as typeof fetch;
    const http = new PoliteHttp(0, fetcher, mkdtempSync(path.join(tmpdir(), "voz-")));
    await expect(http.text("https://exemplo.pt/feed/")).rejects.toThrow(/robots/);
    expect(asked).toEqual(["https://exemplo.pt/robots.txt"]);
  });
});

describe("feeds RSS", () => {
  it("lê título, ligação, autor, data, categorias e texto", () => {
    const [parsed] = parseRssFeed(feed(item({ title: "Incêndio em Runa", text: "Texto <b>completo</b>.", link: "https://www.rtvon.pt/2026/11/02/incendio/?utm_source=rss#topo", creator: "Agência Lusa", categories: ["Sociedade", "Torres Vedras"] })));
    expect(parsed).toEqual({
      url: "https://www.rtvon.pt/2026/11/02/incendio/",
      title: "Incêndio em Runa",
      author: "Agência Lusa",
      published: new Date("2026-11-02T10:00:00Z"),
      categories: ["Sociedade", "Torres Vedras"],
      text: "Texto completo.",
    });
  });

  it("normaliza o URL para o mesmo artigo entrar uma vez", () => {
    expect(canonicalArticleUrl("http://onfm.pt/2026/11/02/x?utm_medium=rss&fbclid=1")).toBe("https://onfm.pt/2026/11/02/x/");
    expect(canonicalArticleUrl("https://onfm.pt/2026/11/02/x/#comentarios")).toBe("https://onfm.pt/2026/11/02/x/");
    expect(canonicalArticleUrl("javascript:alert(1)")).toBeNull();
  });

  it("só abre artigos com indícios de ocorrência, e regista a fonte, o autor e a categoria", async () => {
    const url = "https://www.rtvon.pt/feed/";
    const { input } = fakeInput({
      [url]: feed(
        item({ title: "Incêndio num armazém no Ramalhal", text: "O incêndio deflagrou ontem no Ramalhal, em Torres Vedras.", creator: "Joana Exemplo" }),
        item({ title: "Feira de São Martinho em Torres Vedras", text: "Programa cultural." }),
        item({ title: "Acidente na Lourinhã", text: "Acidente ontem na Lourinhã." }),
      ),
    });
    const records = incidents((await newsFeedCollector({ feedUrl: url, sourceName: "RTV Oeste", maxPages: 1 })(input) as { records: IngestRecord[] }).records);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ sourceName: "RTV Oeste", sourceTier: "IMPRENSA", author: "Joana Exemplo", articleCategory: "Sociedade", category: "INCENDIO", placeName: "Ramalhal" });
  });

  it("lê páginas seguintes só enquanto os artigos estão na janela de 14 dias", async () => {
    const url = "https://onfm.pt/category/torres-vedras/feed/";
    const { input, requested } = fakeInput({
      [url]: feed(item({ title: "Furto em Runa", text: "Furto ontem em Runa." })),
      [`${url}?paged=2`]: feed(item({ title: "Furto antigo em Runa", text: "Furto em Runa.", date: "Mon, 05 Oct 2026 10:00:00 +0000" })),
    });
    await newsFeedCollector({ feedUrl: url, sourceName: "ON FM", maxPages: 3, concelhoImplied: true })(input);
    expect(requested).toEqual([url, `${url}?paged=2`]);
  });
});

const published = new Date("2026-11-02T10:00:00Z");
const news = (sourceName: string, title: string, text: string, extra: Partial<Parameters<typeof buildIncident>[0]> = {}) =>
  buildIncident({ url: `https://exemplo.pt/${encodeURIComponent(title)}`, title, text, published, sourceName, sourceTier: "IMPRENSA", now, ...extra });

describe("área geográfica nas novas fontes", () => {
  it("usa a freguesia quando a categoria local da ON FM não repete o concelho", () => {
    const record = news("ON FM", "Incêndio em Runa", "Incêndio ontem em Runa.", { concelhoImplied: true }) as IncidentRecord;
    expect(record).toMatchObject({ freguesiaSlug: "runa", precision: "FREGUESIA", radiusM: null });
    expect(news("RTV Oeste", "Incêndio em Runa", "Incêndio ontem em Runa.")).toMatchObject({ kind: "incident-rejected", reason: "não refere o concelho de Torres Vedras" });
  });

  it("usa a localidade, nunca a rua, e recusa notícias de outros concelhos", () => {
    const record = news("RTV Oeste", "Acidente em Santa Cruz", "Acidente ontem na Rua do Mar, n.º 12, em Santa Cruz, Torres Vedras.") as IncidentRecord;
    expect(record).toMatchObject({ placeName: "Santa Cruz", precision: "LOCALIDADE" });
    expect(`${record.summary} ${record.claim}`).not.toMatch(/Rua|12/);
    expect(news("RTV Oeste", "Colisão faz um ferido na Lourinhã", "Ferido levado ao hospital de Torres Vedras ontem, na Lourinhã.")).toMatchObject({ reason: expect.stringMatching(/noutro concelho/) });
  });
});

describe("estado e cruzamento", () => {
  const status = (links: Parameters<typeof computeVerification>[0]["sources"], extra: Partial<Parameters<typeof computeVerification>[0]> = {}) =>
    computeVerification({ primaryTier: links[0].sourceTier, phase: null, firstReportedAt: new Date(now.getTime() - 30 * 3_600_000), now, sources: links, ...extra }).status;

  it("entra como «Reportado», ou «Em apuramento» numa notícia ainda em desenvolvimento", () => {
    expect(status([{ sourceTier: "IMPRENSA", agreement: "PRINCIPAL", independenceKey: "rtvon.pt" }])).toBe("REPORTADO");
    const developing = news("RTV Oeste", "Última hora: incêndio no Ramalhal", "Incêndio hoje no Ramalhal, Torres Vedras. Ainda sem informações sobre feridos.") as IncidentRecord;
    expect(developing.flags).toContain("em-desenvolvimento");
    expect(status([{ sourceTier: "IMPRENSA", agreement: "PRINCIPAL", independenceKey: "rtvon.pt" }], { developing: true, firstReportedAt: new Date(now.getTime() - 2 * 3_600_000) })).toBe("EM_APURAMENTO");
  });

  it("nunca fica «Confirmado» só com imprensa, mesmo com várias redações", () => {
    expect(status([
      { sourceTier: "IMPRENSA", agreement: "PRINCIPAL", independenceKey: "rtvon.pt" },
      { sourceTier: "IMPRENSA", agreement: "CORROBORA", independenceKey: "onfm.pt" },
      { sourceTier: "IMPRENSA", agreement: "CORROBORA", independenceKey: "noticiasaominuto.com" },
    ])).toBe("REPORTADO");
    expect(status([
      { sourceTier: "IMPRENSA", agreement: "PRINCIPAL", independenceKey: "onfm.pt" },
      { sourceTier: "OFICIAL", agreement: "CORROBORA", independenceKey: "gnr.pt" },
    ])).toBe("CONFIRMADO");
  });

  it("corrobora uma publicação comunitária com a RTV Oeste e a ON FM, que são independentes", () => {
    expect(status([
      { sourceTier: "COMUNITARIA", agreement: "PRINCIPAL", independenceKey: "facebook:grupo" },
      { sourceTier: "IMPRENSA", agreement: "CORROBORA", independenceKey: independenceKey("https://www.rtvon.pt/a/") },
      { sourceTier: "IMPRENSA", agreement: "CORROBORA", independenceKey: independenceKey("https://onfm.pt/b/") },
    ])).toBe("REPORTADO");
  });

  it("trata a mesma notícia da Lusa nas duas como uma fonte, e os comunicados da Câmara como da Câmara", () => {
    expect(independenceKey("https://www.rtvon.pt/a/", "Agência Lusa")).toBe(independenceKey("https://onfm.pt/b/", "Lusa"));
    expect(independenceKey("https://onfm.pt/b/", "CM Torres Vedras")).toBe("cm-tvedras.pt");
    expect(status([
      { sourceTier: "COMUNITARIA", agreement: "PRINCIPAL", independenceKey: "facebook:grupo" },
      { sourceTier: "IMPRENSA", agreement: "CORROBORA", independenceKey: independenceKey("https://www.rtvon.pt/a/", "Agência Lusa") },
      { sourceTier: "IMPRENSA", agreement: "CORROBORA", independenceKey: independenceKey("https://onfm.pt/b/", "Lusa") },
    ])).toBe("NAO_CONFIRMADO");
  });

  it("fica «Não confirmado» quando as duas rádios divergem", () => {
    expect(status([
      { sourceTier: "IMPRENSA", agreement: "PRINCIPAL", independenceKey: "rtvon.pt" },
      { sourceTier: "IMPRENSA", agreement: "CONTRADIZ", independenceKey: "onfm.pt" },
    ])).toBe("NAO_CONFIRMADO");
  });
});

describe("privacidade nas novas fontes", () => {
  it("não guarda o texto nem copia nomes, idades ou matrículas", () => {
    const record = news("ON FM", "Jovem detido por furto em Runa", "Rui Exemplo, de 19 anos, foi detido ontem em Runa, Torres Vedras, com o carro 12-AB-34.", { concelhoImplied: true }) as IncidentRecord;
    expect(record).not.toHaveProperty("text");
    expect(JSON.stringify([record.summary, record.claim, record.tags])).not.toMatch(/Rui|19|12-AB-34/);
    expect(record.titleFingerprint).not.toMatch(/furto|runa/i);
  });
});

describe("filtro por fonte", () => {
  const base = { freguesiaSlug: "runa", category: "FURTO" as const, incidentStart: "2026-11-01T12:00:00Z" };
  const items = [
    { ...base, verificationStatus: "REPORTADO" as const, sourceName: "RTV Oeste", references: [{ sourceName: "ON FM" }] },
    { ...base, verificationStatus: "EM_APURAMENTO" as const, sourceName: "ON FM", references: [] },
    { ...base, verificationStatus: "CONFIRMADO" as const, sourceName: "GNR", references: [{ sourceName: "RTV Oeste" }] },
  ];

  it("filtra pela fonte principal ou por outra fonte que refira a ocorrência", () => {
    expect(filterIncidents(items, { fonte: "ON FM" })).toEqual([items[0], items[1]]);
    expect(filterIncidents(items, { fonte: "RTV Oeste", estado: "CONFIRMADO" })).toEqual([items[2]]);
    expect(filterIncidents(items, { fonte: "Jornal de Notícias" })).toEqual([]);
  });
});
