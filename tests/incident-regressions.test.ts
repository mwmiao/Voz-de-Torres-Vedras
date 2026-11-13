// Regressões de 2 de novembro de 2026: duas ocorrências reais, dentro dos 14 dias, que não apareciam no mapa.
// Os textos abaixo resumem os artigos por palavras nossas; os títulos e as datas são os originais.

import { describe, expect, it } from "vitest";
import { parseRssFeed } from "../ingestion/parsers/noticias-rss";
import { buildIncident, detectPlace, looksLikeIncident } from "../ingestion/parsers/ocorrencias";
import { newsFeedCollector, type CollectorInput } from "../ingestion/sources";
import type { IncidentRecord, IngestRecord } from "../ingestion/types";
import { validateRecord } from "../ingestion/validators";
import { clampRange, CONCELHO, filterIncidents, isInRange, visibilityProblem, windowStart, windowStartDay } from "../src/lib/incidents";
import { matchClaim } from "../src/lib/verification";

const now = new Date("2026-11-02T15:00:00Z");

const RTV = {
  url: "https://www.rtvon.pt/2026/10/19/dois-mil-litros-de-gasolina-encontrados-junto-a-porto-de-pesca-em-torres-vedras-pj-investiga/",
  title: "Dois mil litros de gasolina encontrados junto a porto de pesca em Torres Vedras. PJ investiga",
  published: new Date("2026-10-19T14:30:00Z"),
  categories: ["Sociedade", "Assenta", "Gasolina", "GNR", "PJ", "Polícia Marítima", "Torres Vedras"],
  text: "Jerricãs com gasolina foram encontrados hoje de madrugada, às 03h30, junto ao porto de pesca da praia da Assenta, em São Pedro da Cadeira, no concelho de Torres Vedras. A GNR esteve no local e a Polícia Judiciária ficou com a investigação.",
};

const JN = {
  url: "https://www.jn.pt/justica/artigo/psp-apreende-catana-espada-e-armas-proibidas-em-torres-vedras/18139796",
  title: "PSP apreende catana, espada e armas proibidas em Torres Vedras",
  published: new Date("2026-10-22T10:55:00Z"),
  text: "A PSP apreendeu várias armas a um homem em Torres Vedras, num processo de violência doméstica. A apreensão foi feita pela Esquadra de Investigação Criminal de Loures.",
};

const record = (input: Partial<Parameters<typeof buildIncident>[0]> & { url: string; title: string; text: string; published: Date }) =>
  buildIncident({ sourceName: "RTV Oeste", sourceTier: "IMPRENSA", now, ...input }) as IncidentRecord;

describe("RTV Oeste: gasolina na praia da Assenta (19 de outubro)", () => {
  it("passa o pré-filtro pelas etiquetas, embora o título não tenha palavras-chave", () => {
    expect(looksLikeIncident(RTV.title, RTV.categories)).toBe(true);
    expect(looksLikeIncident("Feira de São Martinho em Torres Vedras", ["Cultura"])).toBe(false);
  });

  it("aceita uma investigação em curso sem crime definido", () => {
    const incident = record(RTV);
    expect(incident.kind).toBe("incident");
    expect(incident.category).toBe("SEGURANCA_PUBLICA");
    expect(validateRecord(incident)).toEqual([]);
  });

  it("situa na Assenta, em São Pedro da Cadeira, com raio aproximado", () => {
    expect(record(RTV)).toMatchObject({ freguesiaSlug: "sao-pedro-da-cadeira", placeName: "Assenta", precision: "LOCALIDADE", radiusM: 900 });
  });

  it("lê a data e a hora de Lisboa: 19 de outubro, 03h30", () => {
    const incident = record(RTV);
    expect(incident.incidentStart?.toISOString()).toBe("2026-10-19T02:30:00.000Z");
    expect(incident.hasTime).toBe(true);
  });

  it("é lido mesmo na sétima página do feed", async () => {
    const page = (date: string, title: string) =>
      `<rss><channel><item><title>${title}</title><link>https://www.rtvon.pt/${encodeURIComponent(title)}/</link><pubDate>${date}</pubDate><category>Sociedade</category><content:encoded><![CDATA[<p>${title}</p>]]></content:encoded></item></channel></rss>`;
    const pages: Record<string, string> = {};
    for (let n = 1; n <= 6; n += 1) pages[n === 1 ? "https://www.rtvon.pt/feed/" : `https://www.rtvon.pt/feed/?paged=${n}`] = page(`Mon, ${String(2 - Math.min(n, 1)).padStart(2, "0")} Nov 2026 10:00:00 +0000`, `Feira ${n}`);
    pages["https://www.rtvon.pt/feed/?paged=7"] = `<rss><channel><item><title>${RTV.title}</title><link>${RTV.url}</link><pubDate>Mon, 19 Oct 2026 14:30:00 +0000</pubDate>${RTV.categories.map((c) => `<category>${c}</category>`).join("")}<content:encoded><![CDATA[<p>${RTV.text}</p>]]></content:encoded></item></channel></rss>`;
    const http = { text: async (url: string) => ({ body: pages[url] ?? "<rss><channel></channel></rss>", hash: url, notModified: false }) };
    const collected = (await newsFeedCollector({ feedUrl: "https://www.rtvon.pt/feed/", sourceName: "RTV Oeste", maxPages: 20 })({ http, now, revision: null, db: null } as unknown as CollectorInput)) as { records: IngestRecord[]; stats: { found: number; considered: number } };
    expect(collected.records.map((item) => (item as IncidentRecord).sourceUrl)).toEqual([RTV.url]);
    expect(collected.stats).toEqual({ found: 7, considered: 1 });
    expect(parseRssFeed(pages["https://www.rtvon.pt/feed/?paged=7"])[0].published).toEqual(RTV.published);
  });
});

describe("Jornal de Notícias: armas apreendidas (22 de outubro)", () => {
  it("aceita o concelho quando a fonte não indica a freguesia", () => {
    const incident = record({ ...JN, sourceName: "Jornal de Notícias" });
    expect(incident).toMatchObject({ freguesiaSlug: CONCELHO, precision: "CONCELHO", placeName: "Concelho de Torres Vedras" });
    // A apreensão está no título; a violência doméstica só no texto, e fica como etiqueta.
    expect(incident).toMatchObject({ category: "SEGURANCA_PUBLICA", tags: ["Violência doméstica"] });
    expect(incident.summary).toBe("Ocorrência de segurança pública no concelho de Torres Vedras, sem freguesia indicada na fonte.");
    expect(validateRecord(incident)).toEqual([]);
  });

  it("usa a data de publicação quando a fonte não dá a data da apreensão", () => {
    const incident = record({ ...JN, sourceName: "Jornal de Notícias" });
    expect(incident.incidentStart).toEqual(JN.published);
    expect(incident.flags).toContain("data-da-publicacao");
  });

  it("não trata Loures como lugar: aparece só no nome da esquadra", () => {
    expect(detectPlace(`${JN.title}. ${JN.text}`)).toMatchObject({ multipleFreguesias: false, otherConcelhos: [] });
    expect(detectPlace("Homem detido no concelho de Sobral de Monte Agraço; o posto fica em Torres Vedras.").otherConcelhos).toEqual(["sobral de monte agraco"]);
  });

  it("junta a notícia da RTV Oeste sobre a mesma apreensão como fonte que corrobora", () => {
    const jn = record({ ...JN, sourceName: "Jornal de Notícias" });
    const rtv = record({ url: "https://www.rtvon.pt/2026/10/22/psp-apreende-varias-armas-a-homem-em-torres-vedras/", title: "PSP apreende várias armas a homem em Torres Vedras", text: "A PSP apreendeu armas a um homem em Torres Vedras, numa investigação por violência doméstica.", published: new Date("2026-10-22T09:00:00Z") });
    expect(rtv.category).toBe("SEGURANCA_PUBLICA");
    const candidate = { id: "jn", category: jn.category, freguesiaSlug: jn.freguesiaSlug!, placeName: jn.placeName!, precision: jn.precision!, incidentStart: jn.incidentStart!, hasTime: jn.hasTime, titleFingerprint: jn.titleFingerprint };
    expect(matchClaim({ ...candidate, category: rtv.category, incidentStart: rtv.incidentStart!, titleFingerprint: rtv.titleFingerprint }, [candidate])?.agreement).toBe("CORROBORA");
  });

  it("não aceita só o concelho vindo de redes sociais", () => {
    expect(buildIncident({ ...JN, url: "https://www.facebook.com/x/posts/1", sourceName: "Grupo", sourceTier: "COMUNITARIA", now })).toMatchObject({ kind: "incident-rejected" });
  });
});

describe("janela de 14 dias", () => {
  it("inclui o 14.º dia: a 2 de novembro, a janela começa a 19 de outubro", () => {
    expect(windowStartDay(now)).toBe("2026-10-19");
    expect(clampRange(now).min).toBe("2026-10-19");
    expect(isInRange(new Date("2026-10-19T02:30:00Z"), clampRange(now))).toBe(true);
    expect(isInRange(new Date("2026-10-18T22:00:00Z"), clampRange(now))).toBe(false);
    // Meia-noite de 19 de outubro em Lisboa (hora de verão) é 18 de outubro às 23h00 UTC.
    expect(windowStart(now).getTime()).toBeLessThanOrEqual(Date.parse("2026-10-18T23:00:00Z"));
  });

  it("mantém no mapa as ocorrências dentro da janela e tira as anteriores", () => {
    const base = { archivedAt: null, archiveReason: null, heldForReview: false, reviewReasons: "" };
    expect(visibilityProblem({ ...base, incidentStart: new Date("2026-10-19T02:30:00Z") }, now)).toBeNull();
    expect(visibilityProblem({ ...base, incidentStart: new Date("2026-10-22T10:55:00Z") }, now)).toBeNull();
    expect(visibilityProblem({ ...base, incidentStart: new Date("2026-10-17T12:00:00Z") }, now)).toMatch(/fora da janela/);
  });
});

describe("visibilidade por omissão", () => {
  const items = [
    { freguesiaSlug: "sao-pedro-da-cadeira", category: "SEGURANCA_PUBLICA" as const, verificationStatus: "REPORTADO" as const, incidentStart: "2026-10-19T02:30:00Z", sourceName: "RTV Oeste" },
    { freguesiaSlug: CONCELHO, category: "VIOLENCIA_DOMESTICA" as const, verificationStatus: "REPORTADO" as const, incidentStart: "2026-10-22T10:55:00Z", sourceName: "Jornal de Notícias" },
    { freguesiaSlug: "ramalhal", category: "INCENDIO" as const, verificationStatus: "EM_APURAMENTO" as const, incidentStart: "2026-11-02T08:00:00Z", sourceName: "ON FM" },
  ];

  it("mostra «Reportado» e «Em apuramento» sem filtros, também no limite da janela", () => {
    expect(filterIncidents(items, { range: clampRange(now) })).toEqual(items);
  });

  it("mantém as ocorrências só com o concelho fora do filtro de uma freguesia", () => {
    expect(filterIncidents(items, { area: "sao-pedro-da-cadeira" })).toEqual([items[0]]);
  });
});
