import { describe, expect, it } from "vitest";
import {
  buildIncident,
  classifyIncident,
  detectFlags,
  detectPhase,
  detectPlace,
  fingerprintSimilarity,
  parseGnrDetail,
  parseGnrList,
  parseIncidentDate,
  parseNamArticle,
  parseNewsSitemap,
  titleFingerprint,
} from "../ingestion/parsers/ocorrencias";
import { parseMastodonStatuses, parseTelegramChannel, type MastodonStatus } from "../ingestion/parsers/redes-sociais";
import type { IncidentRecord } from "../ingestion/types";
import { validateRecord } from "../ingestion/validators";
import { clampRange, filterIncidents, isInRange } from "../src/lib/incidents";
import { classifySourceTier, detectPersonalData, independenceKey, isArchivable } from "../src/lib/source-tiers";
import { archiveReason, computeVerification, isNearDuplicate, matchClaim, mustHold, reviewReasons, thresholdsFromEnv, type Candidate, type SourceLink } from "../src/lib/verification";

// Segunda-feira, 2 de novembro de 2026.
const now = new Date("2026-11-02T15:00:00Z");
const published = new Date("2026-11-02T10:00:00Z");
const day = (date: Date | null | undefined) => date?.toISOString().slice(0, 10);
const article = (title: string, text: string, extra: Partial<Parameters<typeof buildIncident>[0]> = {}) =>
  buildIncident({ url: "https://www.noticiasaominuto.com/pais/1/x", title, text, published, sourceName: "Notícias ao Minuto", sourceTier: "IMPRENSA", now, ...extra });

describe("classificação de ocorrências", () => {
  it("usa a primeira categoria do título e guarda as outras como etiquetas", () => {
    expect(classifyIncident("Incêndio destrói armazém após acidente", "")).toEqual({ category: "INCENDIO", tags: ["Acidente"], confident: true });
  });

  it("assinala quando a categoria só aparece no corpo do texto", () => {
    expect(classifyIncident("GNR em Ponte do Rol", "Um furto foi participado.")?.confident).toBe(false);
  });

  it("não classifica texto sem ocorrência", () => {
    expect(classifyIncident("Feira de São Martinho abre amanhã", "Programa cultural.")).toBeNull();
  });
});

describe("área geográfica", () => {
  it("prefere a localidade à freguesia e nunca devolve uma morada", () => {
    const { place, doubts } = detectPlace("Acidente na Rua Principal, em Santa Cruz, freguesia de Silveira, concelho de Torres Vedras");
    expect(place).toMatchObject({ placeName: "Santa Cruz", freguesiaSlug: "silveira", precision: "LOCALIDADE", radiusM: 900 });
    expect(doubts).toEqual([]);
  });

  it("não confunde um apelido com uma freguesia", () => {
    expect(detectPlace("O comandante Rui Silveira falou em Torres Vedras").place).toBeNull();
  });

  it("assinala notícias com várias freguesias ou outros concelhos", () => {
    expect(detectPlace("Furtos em Runa e no Turcifal, Torres Vedras").doubts).toContain("refere mais do que uma freguesia");
    expect(detectPlace("Furto no Turcifal, Torres Vedras, e na Lourinhã").doubts[0]).toMatch(/outros concelhos/);
  });
});

describe("data da ocorrência", () => {
  it("lê referências relativas à publicação", () => {
    expect(day(parseIncidentDate("O furto ocorreu ontem à noite", published)?.start)).toBe("2026-11-01");
    expect(day(parseIncidentDate("na madrugada de sábado", published)?.start)).toBe("2026-10-31");
  });

  it("lê uma data escrita e a hora de Lisboa", () => {
    const date = parseIncidentDate("no dia 30 de outubro, pelas 14h30", published);
    expect(date?.hasTime).toBe(true);
    expect(date?.start.toISOString()).toBe("2026-10-30T14:30:00.000Z");
  });

  it("não deduz uma data que o texto não dá", () => {
    expect(parseIncidentDate("Um furto foi participado à GNR", published)).toBeNull();
  });
});

describe("fase e indícios", () => {
  it("só usa «em curso» ou «resolvida» em ocorrências que mudam de estado", () => {
    expect(detectPhase("O incêndio foi dado como extinto", "INCENDIO")).toBe("RESOLVIDO");
    expect(detectPhase("O incêndio continua ativo", "INCENDIO")).toBe("EM_CURSO");
    expect(detectPhase("A investigação está em curso", "FURTO")).toBeNull();
  });

  it("guarda indícios como palavras-chave", () => {
    expect(detectFlags("Criança agredida à porta da escola")).toEqual(["menores", "violencia"]);
    expect(detectFlags("A GNR desmente o assalto")).toContain("desmentido");
  });
});

describe("construção do registo", () => {
  it("cria um relato com resumo e afirmação neutros", () => {
    const record = article("Furto em estabelecimento em Santa Cruz", "Um homem de 34 anos, João Exemplo, foi detido ontem em Santa Cruz, no concelho de Torres Vedras, segundo a GNR.") as IncidentRecord;
    expect(record.kind).toBe("incident");
    expect(record.doubts).toEqual([]);
    expect(record.summary).toBe("Furto na zona de Santa Cruz.");
    expect(record.claim).toBe("Furto · Santa Cruz · 2026-11-01");
    expect(`${record.summary} ${record.claim}`).not.toMatch(/João|34/);
    expect(record.linkPublic).toBe(true);
    expect(day(record.incidentStart)).toBe("2026-11-01");
    expect(validateRecord(record)).toEqual([]);
  });

  it("em violência doméstica mostra apenas a freguesia", () => {
    const record = article("Violência doméstica em Santa Cruz", "Caso registado no domingo em Santa Cruz, Torres Vedras.") as IncidentRecord;
    expect(record).toMatchObject({ precision: "FREGUESIA", placeName: "Silveira", radiusM: null });
  });

  it("assinala as dúvidas das notícias ambíguas", () => {
    const record = article("Furtos no Oeste", "Furtos ontem em Runa, Torres Vedras, e no Cadaval.") as IncidentRecord;
    expect(record.doubts.join()).toMatch(/outros concelhos/);
  });

  it("recusa registos sem data, sem área ou fora do concelho", () => {
    expect(article("Furto em Runa", "Furto em Runa, Torres Vedras.")).toMatchObject({ kind: "incident-rejected", reason: "sem data da ocorrência" });
    expect(article("Furto em Torres Vedras", "Furto ontem no concelho de Torres Vedras.")).toMatchObject({ reason: expect.stringMatching(/só indica o concelho/) });
    expect(article("Furto na Maceira", "Furto ontem na Maceira, em Leiria.")).toMatchObject({ reason: "não refere o concelho de Torres Vedras" });
    expect(article("Furto em Runa", "Furto em Runa, Torres Vedras.", { published: null })).toMatchObject({ reason: "sem data de publicação" });
  });

  it("recusa campanhas e ocorrências com mais de 14 dias", () => {
    expect(article("Campanha contra furtos em Runa", "Ontem em Runa, Torres Vedras.")).toMatchObject({ kind: "incident-rejected" });
    expect(article("Furto em Runa", "No dia 2 de outubro, em Runa, Torres Vedras.")).toMatchObject({ reason: "ocorrência com mais de 14 dias" });
  });

  it("aceita redes sociais, sem publicar a ligação quando há dados pessoais", () => {
    const post = article("Furto em Runa", "Ontem em Runa, Torres Vedras, roubaram o carro do Sr. Silva, matrícula AA-12-BB.", { url: "https://www.facebook.com/post/1", sourceTier: "COMUNITARIA", sourceName: "Grupo local" }) as IncidentRecord;
    expect(validateRecord(post)).toEqual([]);
    expect(post.linkPublic).toBe(false);
    expect(post.linkNote).toMatch(/dados pessoais/);
    expect(`${post.summary} ${post.claim}`).not.toMatch(/Silva|AA-12-BB/);
  });

  it("nunca publica ligações que não podem ser arquivadas", () => {
    const post = article("Furto em Runa", "Ontem em Runa, Torres Vedras.", { url: "https://chat.whatsapp.com/abc", sourceTier: "COMUNITARIA" }) as IncidentRecord;
    expect(post.linkPublic).toBe(false);
    expect(isArchivable("https://www.facebook.com/groups/tv/posts/1")).toBe(false);
  });
});

describe("duplicados", () => {
  it("compara títulos pelas impressões das palavras", () => {
    const a = titleFingerprint("Incêndio em armazém no Ramalhal mobiliza bombeiros");
    const b = titleFingerprint("Bombeiros combatem incêndio em armazém no Ramalhal");
    expect(fingerprintSimilarity(a, b)).toBeGreaterThan(0.5);
    expect(fingerprintSimilarity(a, titleFingerprint("Furto de cobre em Runa"))).toBe(0);
    expect(a).not.toMatch(/armazem/);
  });
});

describe("níveis das fontes", () => {
  const registry = [{ platform: "telegram", handle: "GNR_oficial", name: "GNR", tier: "CONTA_OFICIAL" as const }];

  it("classifica autoridades, imprensa, contas oficiais e fontes comunitárias", () => {
    expect(classifySourceTier("https://www.gnr.pt/comunicado.aspx?linha=1")).toBe("OFICIAL");
    expect(classifySourceTier("https://www.cm-tvedras.pt/artigos/avisos/x")).toBe("OFICIAL");
    expect(classifySourceTier("https://www.noticiasaominuto.com/pais/1/x")).toBe("IMPRENSA");
    expect(classifySourceTier("https://t.me/GNR_oficial/12", { platform: "telegram", handle: "gnr_oficial" }, registry)).toBe("CONTA_OFICIAL");
    expect(classifySourceTier("https://t.me/vizinhos/12", { platform: "telegram", handle: "vizinhos" }, registry)).toBe("COMUNITARIA");
    expect(classifySourceTier("https://www.facebook.com/groups/tv/posts/1")).toBe("COMUNITARIA");
    expect(classifySourceTier("https://blog-desconhecido.pt/post")).toBe("COMUNITARIA");
  });

  it("trata a Lusa republicada por várias redações como uma só fonte", () => {
    expect(independenceKey("https://www.noticiasaominuto.com/pais/1", "Lusa")).toBe(independenceKey("https://www.rtp.pt/noticias/1", "Agência Lusa"));
    expect(independenceKey("https://www.rtp.pt/x")).not.toBe(independenceKey("https://www.publico.pt/x"));
  });
});

const sources = (...items: [SourceLink["sourceTier"], SourceLink["agreement"], string, boolean?][]): SourceLink[] =>
  items.map(([sourceTier, agreement, key, duplicate]) => ({ sourceTier, agreement, independenceKey: key, duplicate }));
const verify = (primaryTier: SourceLink["sourceTier"], links: SourceLink[], hoursAgo = 30, extra: Partial<Parameters<typeof computeVerification>[0]> = {}) =>
  computeVerification({ primaryTier, phase: null, firstReportedAt: new Date(now.getTime() - hoursAgo * 3_600_000), now, sources: links, ...extra });

describe("estado de verificação", () => {
  it("usa o estado inicial de cada nível", () => {
    expect(verify("OFICIAL", sources(["OFICIAL", "PRINCIPAL", "gnr.pt"])).status).toBe("CONFIRMADO");
    expect(verify("IMPRENSA", sources(["IMPRENSA", "PRINCIPAL", "rtp.pt"])).status).toBe("REPORTADO");
    expect(verify("COMUNITARIA", sources(["COMUNITARIA", "PRINCIPAL", "fb:a"]), 2).status).toBe("EM_APURAMENTO");
    expect(verify("COMUNITARIA", sources(["COMUNITARIA", "PRINCIPAL", "fb:a"]), 30).status).toBe("NAO_CONFIRMADO");
    expect(verify("IMPRENSA", sources(["IMPRENSA", "PRINCIPAL", "rtp.pt"]), 2, { phase: "EM_CURSO" }).status).toBe("EM_APURAMENTO");
  });

  it("sobe para «Reportado» só com duas redações independentes", () => {
    const one = sources(["COMUNITARIA", "PRINCIPAL", "fb:a"], ["IMPRENSA", "CORROBORA", "rtp.pt"]);
    expect(verify("COMUNITARIA", one).status).toBe("NAO_CONFIRMADO");
    const lusaTwice = sources(["COMUNITARIA", "PRINCIPAL", "fb:a"], ["IMPRENSA", "CORROBORA", "lusa"], ["IMPRENSA", "CORROBORA", "lusa"]);
    expect(verify("COMUNITARIA", lusaTwice).status).toBe("NAO_CONFIRMADO");
    const two = sources(["COMUNITARIA", "PRINCIPAL", "fb:a"], ["IMPRENSA", "CORROBORA", "rtp.pt"], ["IMPRENSA", "ACRESCENTA", "publico.pt"]);
    expect(verify("COMUNITARIA", two).status).toBe("REPORTADO");
  });

  it("sobe para «Confirmado» com uma fonte oficial", () => {
    expect(verify("COMUNITARIA", sources(["COMUNITARIA", "PRINCIPAL", "fb:a"], ["OFICIAL", "CORROBORA", "gnr.pt"])).status).toBe("CONFIRMADO");
  });

  it("não confirma por repetição", () => {
    const many = sources(["COMUNITARIA", "PRINCIPAL", "fb:a"], ["COMUNITARIA", "CORROBORA", "fb:b"], ["CONTA_OFICIAL", "CORROBORA", "x:c"], ["COMUNITARIA", "CORROBORA", "fb:d"]);
    expect(verify("COMUNITARIA", many).status).toBe("NAO_CONFIRMADO");
  });

  it("fica «Não confirmado» com factos em conflito, e arquiva com uma fonte oficial contrária", () => {
    const conflict = verify("IMPRENSA", sources(["IMPRENSA", "PRINCIPAL", "rtp.pt"], ["COMUNITARIA", "CONTRADIZ", "fb:a"]));
    expect(conflict).toMatchObject({ status: "NAO_CONFIRMADO", hasConflict: true, officialContradiction: false });
    const official = verify("COMUNITARIA", sources(["COMUNITARIA", "PRINCIPAL", "fb:a"], ["OFICIAL", "CONTRADIZ", "gnr.pt"]));
    expect(official.officialContradiction).toBe(true);
    expect(archiveReason({ status: official.status, officialContradiction: true, primaryRemoved: false, primaryTier: "COMUNITARIA", firstReportedAt: now, now })).toBe("contrariada por uma fonte oficial");
  });

  it("desce quando a publicação original muda ou é apagada, e arquiva sem confirmação", () => {
    expect(verify("COMUNITARIA", sources(["COMUNITARIA", "PRINCIPAL", "fb:a"]), 2, { sourceChanged: true }).status).toBe("NAO_CONFIRMADO");
    const removed: SourceLink[] = [{ sourceTier: "COMUNITARIA", agreement: "PRINCIPAL", independenceKey: "fb:a", removed: true }];
    expect(archiveReason({ status: verify("COMUNITARIA", removed).status, officialContradiction: false, primaryRemoved: true, primaryTier: "COMUNITARIA", firstReportedAt: now, now })).toBe("a publicação original foi removida");
    const old = new Date(now.getTime() - 8 * 86_400_000);
    expect(archiveReason({ status: "NAO_CONFIRMADO", officialContradiction: false, primaryRemoved: false, primaryTier: "COMUNITARIA", firstReportedAt: old, now })).toBe("sem confirmação ao fim de 7 dias");
    expect(archiveReason({ status: "CONFIRMADO", officialContradiction: false, primaryRemoved: false, primaryTier: "OFICIAL", firstReportedAt: old, now })).toBeNull();
  });

  it("lê os limites das variáveis de ambiente", () => {
    expect(thresholdsFromEnv({ INCIDENT_ARCHIVE_DAYS: "3", INCIDENT_REPETITION_THRESHOLD: "lixo" })).toMatchObject({ unconfirmedArchiveDays: 3, repetitionThreshold: 5 });
  });
});

describe("correspondência entre fontes", () => {
  const base: Candidate = {
    id: "a", category: "INCENDIO", freguesiaSlug: "ramalhal", placeName: "Ramalhal", precision: "FREGUESIA",
    incidentStart: new Date("2026-11-01T12:00:00Z"), hasTime: false, titleFingerprint: titleFingerprint("Incêndio em armazém no Ramalhal"),
  };
  const claim = (patch: Partial<Candidate>) => ({ ...base, ...patch });

  it("junta relatos da mesma ocorrência sem depender do título", () => {
    expect(matchClaim(claim({ titleFingerprint: titleFingerprint("Bombeiros no local") }), [base])?.agreement).toBe("CORROBORA");
    expect(matchClaim(claim({ hasTime: true, incidentStart: new Date("2026-11-01T15:00:00Z") }), [base])?.agreement).toBe("ACRESCENTA");
  });

  it("assinala conflitos de tipo, local ou desmentidos", () => {
    expect(matchClaim(claim({ category: "FURTO" }), [base])?.agreement).toBe("CONTRADIZ");
    expect(matchClaim(claim({ freguesiaSlug: "runa", placeName: "Runa" }), [base])).toMatchObject({ agreement: "CONTRADIZ", reason: expect.stringMatching(/freguesias/) });
    expect(matchClaim(claim({ denies: true }), [base])?.agreement).toBe("CONTRADIZ");
  });

  it("não junta ocorrências distantes no tempo ou sem relação", () => {
    expect(matchClaim(claim({ incidentStart: new Date("2026-11-05T12:00:00Z") }), [base])).toBeNull();
    expect(matchClaim(claim({ category: "FURTO", titleFingerprint: titleFingerprint("Furto de cobre") }), [base])).toBeNull();
  });

  it("trata partilhas quase iguais como uma só afirmação", () => {
    const a = { titleFingerprint: titleFingerprint("Assalto a casa em Runa esta noite"), publicationDate: now, sourceTier: "COMUNITARIA" as const };
    expect(isNearDuplicate(a, { ...a, publicationDate: new Date(now.getTime() + 3_600_000) })).toBe(true);
    expect(isNearDuplicate(a, { ...a, sourceTier: "IMPRENSA" })).toBe(false);
  });
});

describe("revisão", () => {
  const input = { primaryTier: "COMUNITARIA" as const, category: "FURTO" as const, flags: [], status: "EM_APURAMENTO" as const, hasConflict: false, firstReportedAt: now, now, unofficialCount: 1, engagement: 0 };

  it("assinala alegações graves, violência, menores, conflitos, difusão e demora", () => {
    expect(reviewReasons(input)).toEqual([]);
    expect(reviewReasons({ ...input, category: "VIOLENCIA_DOMESTICA" })).toEqual(["alegação grave", "violência doméstica"]);
    expect(reviewReasons({ ...input, flags: ["menores"] })).toContain("envolve menores");
    expect(reviewReasons({ ...input, hasConflict: true })).toContain("fontes em conflito");
    expect(reviewReasons({ ...input, unofficialCount: 5, engagement: 80 })).toEqual(["muitas publicações repetidas", "grande difusão"]);
    expect(reviewReasons({ ...input, firstReportedAt: new Date(now.getTime() - 49 * 3_600_000) })).toContain("sem confirmação há mais de 48 horas");
    expect(reviewReasons({ ...input, primaryTier: "IMPRENSA", category: "AGRESSAO" })).toEqual([]);
  });

  it("retém até revisão casos de redes sociais com menores ou violência doméstica", () => {
    expect(mustHold({ primaryTier: "COMUNITARIA", category: "VIOLENCIA_DOMESTICA", flags: [] }, false)).toBe(true);
    expect(mustHold({ primaryTier: "IMPRENSA", category: "VIOLENCIA_DOMESTICA", flags: [] }, false)).toBe(false);
    expect(mustHold({ primaryTier: "IMPRENSA", category: "FURTO", flags: [] }, true)).toBe(true);
  });
});

describe("privacidade", () => {
  it("deteta dados pessoais", () => {
    expect(detectPersonalData("Homem de 34 anos")).toEqual(["idade"]);
    expect(detectPersonalData("Carro com a matrícula 12-AB-34")).toEqual(["matrícula"]);
    expect(detectPersonalData("Na Rua da Liberdade, 23")).toEqual(["morada"]);
    expect(detectPersonalData("Liguem para 912 345 678")).toEqual(["telefone"]);
    expect(detectPersonalData("O senhor Manuel estava em casa")).toEqual(["nome"]);
    expect(detectPersonalData("Furto em Runa durante a noite")).toEqual([]);
  });
});

describe("filtro por estado", () => {
  const items = [
    { freguesiaSlug: "runa", category: "FURTO" as const, verificationStatus: "CONFIRMADO" as const, incidentStart: "2026-11-01T12:00:00Z", sourceName: "GNR" },
    { freguesiaSlug: "runa", category: "FURTO" as const, verificationStatus: "NAO_CONFIRMADO" as const, incidentStart: "2026-11-01T12:00:00Z", sourceName: "Grupo local" },
    { freguesiaSlug: "turcifal", category: "INCENDIO" as const, verificationStatus: "EM_APURAMENTO" as const, incidentStart: "2026-10-25T12:00:00Z", sourceName: "RTV Oeste" },
  ];

  it("mostra todos por omissão e filtra por estado, área e datas", () => {
    expect(filterIncidents(items, {})).toHaveLength(3);
    expect(filterIncidents(items, { estado: "NAO_CONFIRMADO" })).toEqual([items[1]]);
    expect(filterIncidents(items, { estado: "CONFIRMADO", area: "turcifal" })).toEqual([]);
    expect(filterIncidents(items, { range: { from: "2026-10-30", to: "2026-11-02" } })).toHaveLength(2);
  });
});

describe("redes sociais", () => {
  it("lê publicações públicas do Mastodon e ignora as privadas", () => {
    const status = (patch: Partial<MastodonStatus>): MastodonStatus => ({ url: "https://masto.pt/@a/1", uri: "x", created_at: "2026-11-02T10:00:00Z", content: "<p>Incêndio em Runa</p>", visibility: "public", reblogs_count: 2, favourites_count: 3, account: { acct: "a" }, ...patch });
    expect(parseMastodonStatuses([status({}), status({ visibility: "unlisted" })])).toEqual([{ url: "https://masto.pt/@a/1", handle: "a", text: "Incêndio em Runa", published: new Date("2026-11-02T10:00:00Z"), engagement: 5 }]);
  });

  it("lê canais públicos de Telegram e atribui partilhas ao canal de origem", () => {
    const html = `<div class="tgme_widget_message" data-post="vizinhos/7"><a class="tgme_widget_message_forwarded_from_name" href="https://t.me/origem">Origem</a><div class="tgme_widget_message_text">Acidente em Runa</div><span class="tgme_widget_message_views">1.2K</span><time datetime="2026-11-02T10:00:00+00:00"></time></div>`;
    expect(parseTelegramChannel(html, "vizinhos")).toEqual([{ url: "https://t.me/vizinhos/7", handle: "origem", text: "Acidente em Runa", published: new Date("2026-11-02T10:00:00Z"), engagement: 12 }]);
  });
});

describe("janela de 14 dias", () => {
  it("limita as datas escolhidas aos últimos 14 dias", () => {
    expect(clampRange(now)).toEqual({ from: "2026-10-20", to: "2026-11-02", min: "2026-10-20", max: "2026-11-02" });
    expect(clampRange(now, "2026-01-01", "2027-01-01")).toMatchObject({ from: "2026-10-20", to: "2026-11-02" });
    expect(clampRange(now, "2026-11-01", "2026-10-25")).toMatchObject({ from: "2026-10-25", to: "2026-11-01" });
    expect(clampRange(now, "lixo")).toMatchObject({ from: "2026-10-20" });
  });

  it("usa o dia civil de Lisboa", () => {
    // Na hora de verão, 23h30 UTC já é o dia seguinte em Lisboa.
    expect(isInRange(new Date("2026-10-19T23:30:00Z"), { from: "2026-10-20", to: "2026-11-02" })).toBe(true);
    // Na hora de inverno, Lisboa coincide com UTC.
    expect(isInRange(new Date("2026-11-01T23:30:00Z"), { from: "2026-11-02", to: "2026-11-02" })).toBe(false);
  });
});

describe("fontes", () => {
  it("lê a lista e o detalhe dos comunicados da GNR", () => {
    const list = `<table id="ctl00_Conteudo_ListaComunicados"><tr><td><tr><th><a href="comunicado.aspx?linha=9560"><div>Atividade operacional</div></a></th></tr><tr><th><div>Resumo</div></th></tr><tr><th><div>26-10-2026</div></th></tr></td></tr></table>`;
    expect(parseGnrList(list)).toEqual([{ url: "https://www.gnr.pt/comunicado.aspx?linha=9560", title: "Atividade operacional", published: new Date("2026-10-26T12:00:00Z") }]);
    const detail = `<table id="ctl00_Conteudo_DetalheNoticia"><tr><td><span id="ctl00_Conteudo_DetalheNoticia_titulo">Furto em Runa</span><img src="x">Texto do comunicado.<span id="ctl00_Conteudo_DetalheNoticia_datainicio">01-11-2026</span></td></tr></table>`;
    expect(parseGnrDetail(detail)).toEqual({ title: "Furto em Runa", text: "Texto do comunicado.", published: new Date("2026-11-01T12:00:00Z") });
  });

  it("lê o sitemap de notícias e só guarda a secção País", () => {
    const xml = `<urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"><url><loc>https://www.noticiasaominuto.com/pais/1/furto</loc><news:news><news:publication_date>2026-11-02T10:00:00+00:00</news:publication_date><news:title>Furto em Runa</news:title></news:news></url><url><loc>https://www.noticiasaominuto.com/tech/2/x</loc><news:news><news:title>Outro</news:title></news:news></url></urlset>`;
    expect(parseNewsSitemap(xml)).toEqual([{ url: "https://www.noticiasaominuto.com/pais/1/furto", title: "Furto em Runa", published: new Date("2026-11-02T10:00:00Z") }]);
  });

  it("lê título, data, autor e texto de um artigo", () => {
    const html = `<script type="application/ld+json">{"@type":"NewsArticle","headline":"Furto em Runa","datePublished":"2026-11-02T10:00:00+00:00","author":{"name":"Lusa"}}</script><div class="article-content"><p>Primeiro parágrafo.</p><p>Leia Também: outra</p><p>Segundo.</p></div>`;
    expect(parseNamArticle(html)).toEqual({ title: "Furto em Runa", text: "Primeiro parágrafo. Segundo.", published: new Date("2026-11-02T10:00:00Z"), author: "Lusa" });
  });
});
