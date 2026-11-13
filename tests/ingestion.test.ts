import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PoliteHttp } from "../ingestion/fetchers/http";
import { filterJsonArray } from "../ingestion/fetchers/open-data";
import { canonicalUrl, dateFromPath, lisbonDate } from "../ingestion/normalizers";
import { parseEditalPage, parseFinance, parseMedia } from "../ingestion/parsers/assembleia";
import { parseAnnouncements, parseModifications } from "../ingestion/parsers/base";
import { parseAtasIndex, parseComposicao, parseContratacao, parseEditaisIndex, parseEditalMeeting, parseGestao, parseRegulamentos } from "../ingestion/parsers/camara";
import { diffFields } from "../ingestion/updaters/diff";
import { assertMinimum, validateRecord } from "../ingestion/validators";
import { SOURCE_CATALOG } from "../src/lib/source-catalog";
import { COLLECTORS } from "../ingestion/sources";

const CM = "https://www.cm-tvedras.pt/documentos/editaisatas/editaiscm";

describe("catálogo de origens", () => {
  it("cada origem ativa tem recolha, e cada recolha tem origem", () => {
    const active = SOURCE_CATALOG.filter((source) => source.mode === "automatic" && source.id !== "transcricao-oficial").map((source) => source.id).sort();
    expect(Object.keys(COLLECTORS).sort()).toEqual(active);
  });

  it("cada origem tem os metadados obrigatórios e URL oficial", () => {
    for (const source of SOURCE_CATALOG) {
      expect(source.baseUrl).toMatch(/^https:\/\//);
      expect(source.validation).toBeTruthy();
      expect(source.access).toBeTruthy();
    }
  });

  it("uma origem desativada explica porquê", () => {
    for (const source of SOURCE_CATALOG.filter((item) => item.mode !== "automatic")) expect(source.disabledReason).toBeTruthy();
  });
});

describe("parsers da Câmara", () => {
  it("lê o índice de editais", () => {
    const html = `<ul><li><a href="?id=3377">Edital N.º 149/2026 - Reunião pública do executivo</a></li><li><a href="?id=1">Outra coisa</a></li></ul>`;
    expect(parseEditaisIndex(html, CM)).toEqual([
      { number: "149", year: 2026, title: "Edital N.º 149/2026 - Reunião pública do executivo", url: `${CM}?id=3377` },
    ]);
  });

  it("lê data, hora e local de uma convocação", () => {
    const html = `<div class="paginaDetail"><p>TORNA PÚBLICO, que a próxima reunião pública da Câmara Municipal, realizar-se-á no dia 27 de outubro de 2026, (terça-feira) pelas 9h30m, no Salão Paroquial da Carvoeira, sito no Largo da Igreja, na qual haverá um período</p></div>`;
    const meeting = parseEditalMeeting(html, `${CM}?id=3377`, "Edital N.º 149/2026 - Reunião pública do executivo do mês de outubro de 2026");
    expect(meeting?.date.toISOString()).toBe("2026-10-27T09:30:00.000Z");
    expect(meeting?.location).toBe("Salão Paroquial da Carvoeira, sito no Largo da Igreja");
    expect(meeting?.title).toBe("Reunião pública do executivo do mês de outubro de 2026");
  });

  it("não inventa uma reunião sem data no texto", () => {
    expect(parseEditalMeeting(`<div class="paginaDetail"><p>Sem data.</p></div>`, CM, "Edital")).toBeNull();
  });

  it("lê atas e minutas, e deriva a reunião da minuta", () => {
    const html = `<ul class="ataseditais-list"><li><ul><li><a href="/assets/upload/documentos/2026/10/27/10-27/10-27.pdf">Reunião ordinária - 27 de outubro de 2026</a></li><li><a href="/assets/upload/documentos/2026/09/09/a/a.pdf">Ata n.º 15/2026</a></li></ul></li></ul>`;
    const { documents, meetings } = parseAtasIndex(html, "https://www.cm-tvedras.pt/documentos/editaisatas/atascm");
    expect(documents.map((item) => item.docType)).toEqual(["MINUTA", "ATA"]);
    expect(documents[0].publishedAt?.toISOString().slice(0, 10)).toBe("2026-10-27");
    expect(meetings).toHaveLength(1);
    expect(meetings[0].date.toISOString().slice(0, 10)).toBe("2026-10-27");
  });

  it("indica o ano dos documentos de gestão", () => {
    const html = `<h2><a href="#gestaodetail-38" data-show-id="gestaodetail-38">Documentos de Gestão de 2026</a></h2><div id="gestaodetail-38"><h2>Documentos previsionais</h2><ul><li><a href="http://www.cm-tvedras.pt/assets/upload/x/2026/01/06/rom/rom.pdf">Relatório</a></li></ul></div>`;
    const [record] = parseGestao(html, "https://www.cm-tvedras.pt/documentos/gestao/");
    expect(record.title).toBe("2026, Documentos previsionais: Relatório");
    expect(record.url.startsWith("https://")).toBe(true);
  });

  it("lê regulamentos com a sua secção", () => {
    const html = `<ul class="requerimentos-list"><li><strong>Geral</strong><ul><li><a href="?r=codigo">Código de Posturas</a></li></ul></li></ul>`;
    const [record] = parseRegulamentos(html, "https://www.cm-tvedras.pt/documentos/regulamentos/");
    expect(record.url).toBe("https://www.cm-tvedras.pt/documentos/regulamentos/?r=codigo");
    expect(record.data).toEqual({ seccao: "Geral" });
  });

  it("associa os anúncios ao procedimento", () => {
    const html = `<div class="paginaDetail"><p><strong>Aquisição de livros diversos</strong></p><p>Texto</p><ul><li><a href="/assets/upload/paginas/2026/10/23/a/a.pdf">Anúncio DRE</a></li></ul></div>`;
    const [record] = parseContratacao(html, "https://www.cm-tvedras.pt/x/");
    expect(record.title).toBe("Aquisição de livros diversos: Anúncio DRE");
  });

  it("guarda pelouros, mas nunca contactos pessoais", () => {
    const html = `<article><h3 class="h4">Rita Sammer</h3><h4>vereadora</h4><h5>Unidos por Torres Vedras</h5><p class="cf">Educação<br />Eficiência, Tecnologia e lA</p></article>
      <article><h3 class="h4">Rui Lopes</h3><h4>vereador</h4><h5>PS - Partido Socialista</h5><p class="cf"><a href="#">ver biografia</a><br />261 310 437<br />rui@cm-tvedras.pt</p></article>`;
    const [first, second] = parseComposicao(html, "https://www.cm-tvedras.pt/o/composicaocm");
    expect(first.portfolios).toEqual(["Educação", "Eficiência, Tecnologia e IA"]);
    expect(second.portfolios).toEqual([]);
    expect(second.party).toBe("PS — Partido Socialista");
    expect(JSON.stringify(second)).not.toContain("@");
  });
});

describe("parsers da Assembleia", () => {
  it("usa o nome do ficheiro quando o título está vazio ou não tem palavras", () => {
    const [empty, numeric] = parseMedia([
      { date: "2026-10-27T10:00:00", title: { rendered: "" }, source_url: "http://www.am-tvedras.pt/wp-content/uploads/Mocao-Exemplo.pdf" },
      { date: "2026-10-27T10:00:00", title: { rendered: "10-27" }, source_url: "https://www.am-tvedras.pt/wp-content/uploads/10-27.pdf" },
    ]);
    expect(empty.title).toBe("Mocao Exemplo");
    expect(empty.url.startsWith("https://")).toBe(true);
    expect(numeric.title).toBe("Documento da Assembleia Municipal (10-27)");
  });

  const edital = (content: string) => ({
    date: "2026-10-01T10:00:00",
    link: "https://www.am-tvedras.pt/edital-n-12-2026/",
    title: { rendered: "Edital n.º 12/2026" },
    content: { rendered: content },
  });

  it("deriva uma sessão convocada do edital", () => {
    const { document, meeting } = parseEditalPage(edital("<p>Edital n.º 12/2026 - Sessão Ordinária de 14 de outubro</p><p>Download do Original</p><p>reúne no Salão Paroquial da Carvoeira, com a seguinte ordem, pelas 21.00 horas</p>"));
    expect(document.title).toBe("Edital n.º 12/2026: Sessão Ordinária de 14 de outubro");
    expect(meeting?.date.toISOString()).toBe("2026-10-14T20:00:00.000Z");
    expect(meeting?.location).toBe("Salão Paroquial da Carvoeira");
  });

  it("não cria sessões a partir de editais de deliberações", () => {
    expect(parseEditalPage(edital("<p>Edital n.º 10/2026 - Sessão Ordinária de 24 de junho - Deliberações</p>")).meeting).toBeNull();
  });

  const finance = `informa-se (dados à data de 19/06/2026): TOTAL DE DISPONIBILIDADES ____ 22 128 870,49 EUR DIVIDA DE MÉDIO E LONGO PRAZO (empréstimos e locações financeiras) __ 14 445 842,08 EUR
    Contratos-Programa ____ 66 344,68 EUR Outras dividas a fornecedores e outros credores ___ 1 236 163,42 EUR O limite da dívida total para 2026 é de 135 780 133,43 EUR. O valor da dívida total da autarquia a 19/06/2026 é de 14 180 307,91 EUR`;

  it("lê a situação financeira de uma informação do Presidente", () => {
    const records = parseFinance(finance, "https://www.am-tvedras.pt/info.pdf");
    expect(records).toHaveLength(6);
    expect(records?.find((item) => item.label === "Total de disponibilidades")?.amountEur).toBe(22128870.49);
    expect(records?.find((item) => item.label === "Dívida total da autarquia")?.amountEur).toBe(14180307.91);
    expect(records?.[0].asOf.toISOString().slice(0, 10)).toBe("2026-06-19");
  });

  it("recusa um PDF sem data de referência ou sem disponibilidades", () => {
    expect(parseFinance("TOTAL DE DISPONIBILIDADES ___ 10,00 EUR", "https://x")).toBeNull();
    expect(parseFinance("dados à data de 19/06/2026", "https://x")).toBeNull();
  });
});

describe("Portal BASE", () => {
  it("filtra os anúncios às entidades municipais", () => {
    const records = parseAnnouncements([
      { nifEntidade: "502173653", descricaoAnuncio: "Aluguer  de fardamento", url: "https://files.diariodarepublica.pt/a.pdf", tipoActo: "Anúncio de procedimento", dataPublicacao: "20/04/2026", PrecoBase: "100.5" },
      { nifEntidade: "503093742", descricaoAnuncio: "Outro", url: "https://files.diariodarepublica.pt/b.pdf" },
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].title).toBe("Anúncio de procedimento: Aluguer de fardamento");
    expect(records[0].data?.precoBase).toBe(100.5);
  });

  it("só aceita modificações de contratos conhecidos", () => {
    const records = parseModifications(
      [
        { idcontrato: "1", modifContratoData: "21/05/2026 00:00:00", modifContratoPrecoAlterado: 10, modifContratoTipoAto: "Acordo" },
        { idcontrato: "2", modifContratoData: "21/05/2026 00:00:00" },
      ],
      new Set(["1"]),
    );
    expect(records).toHaveLength(1);
    expect(records[0].date?.toISOString().slice(0, 10)).toBe("2026-05-21");
    expect(records[0].sourceUrl).toContain("id=1");
  });

  it("filtra um JSON enorme sem o interpretar todo", () => {
    const rows = [{ id: 1, nif: "502173653" }, { id: 2, nif: "999", texto: 'com } e " dentro' }, { id: 3, nif: "680015973", lista: [{ a: 1 }] }];
    const bytes = new TextEncoder().encode(JSON.stringify(rows));
    const found = [...filterJsonArray<{ id: number }>(bytes, ["502173653", "680015973"])];
    expect(found.map((row) => row.id)).toEqual([1, 3]);
  });
});

describe("normalização", () => {
  it("uniformiza URL e evita duplicados http/https", () => {
    expect(canonicalUrl("http://www.cm-tvedras.pt/a.pdf", CM)).toBe("https://www.cm-tvedras.pt/a.pdf");
    expect(canonicalUrl("?id=1", CM)).toBe(`${CM}?id=1`);
    expect(canonicalUrl("file://partilha/a.pdf", CM)).toBeNull();
  });

  it("não reescreve domínios externos", () => {
    expect(canonicalUrl("http://cmtvdata.info/a.pdf", CM)).toBe("http://cmtvdata.info/a.pdf");
  });

  it("converte a hora de Lisboa, com e sem hora de verão", () => {
    expect(lisbonDate(2026, 7, 1, 21, 0).toISOString()).toBe("2026-07-01T20:00:00.000Z");
    expect(lisbonDate(2026, 12, 1, 21, 0).toISOString()).toBe("2026-12-01T21:00:00.000Z");
  });

  it("lê a data dos caminhos de ficheiros", () => {
    expect(dateFromPath("https://x/2026/10/27/a.pdf")?.toISOString().slice(0, 10)).toBe("2026-10-27");
    expect(dateFromPath("https://x/a.pdf")).toBeNull();
  });
});

describe("validação", () => {
  const document = { kind: "document" as const, url: "https://www.am-tvedras.pt/a.pdf", title: "Ata", publisher: "AM", docType: "ATA" as const, category: "REUNIAO" as const };

  it("aceita um registo completo", () => {
    expect(validateRecord(document)).toEqual([]);
  });

  it("recusa registos sem ligação à fonte ou sem título", () => {
    expect(validateRecord({ ...document, url: "" })).toHaveLength(1);
    expect(validateRecord({ ...document, title: "" })).toHaveLength(1);
  });

  it("para quando a página deixa de ter a estrutura esperada", () => {
    expect(() => assertMinimum([1], 5, "editais")).toThrow(/Estrutura da fonte alterada/);
  });

  it("deteta campos alterados, sem contar diferenças de maiúsculas", () => {
    const changes = diffFields<{ title: string; price: number }>({ title: "Obra", price: 10 }, { title: "OBRA", price: 12.5 }, ["title", "price"]);
    expect(changes).toEqual([{ field: "price", oldValue: "10", newValue: "12.5" }]);
  });
});

describe("acesso respeitoso", () => {
  const cacheDir = () => mkdtempSync(path.join(tmpdir(), "voz-"));
  const respond = (routes: Record<string, () => Response>): typeof fetch =>
    (async (input: RequestInfo | URL) => (routes[String(input)] ?? (() => new Response("", { status: 404 })))()) as typeof fetch;

  it("recusa caminhos excluídos pelo robots.txt, sem os pedir", async () => {
    let requested = false;
    const http = new PoliteHttp(0, respond({
      "https://x.pt/robots.txt": () => new Response("User-agent: *\nDisallow: /ficheiros/"),
      "https://x.pt/ficheiros/a.pdf": () => { requested = true; return new Response("x"); },
    }), cacheDir());
    await expect(http.text("https://x.pt/ficheiros/a.pdf")).rejects.toThrow(/robots/);
    expect(requested).toBe(false);
  });

  it("cancela uma página pública se não conseguir ler o robots.txt", async () => {
    const http = new PoliteHttp(0, respond({ "https://x.pt/robots.txt": () => new Response("", { status: 500 }) }), cacheDir());
    await expect(http.text("https://x.pt/a")).rejects.toThrow(/robots/);
  });

  it("não insiste quando o servidor pede para abrandar", async () => {
    let calls = 0;
    const http = new PoliteHttp(0, respond({
      "https://x.pt/robots.txt": () => new Response(""),
      "https://x.pt/a": () => { calls += 1; return new Response("", { status: 429 }); },
    }), cacheDir());
    await expect(http.text("https://x.pt/a")).rejects.toThrow(/abrandar/);
    expect(calls).toBe(1);
  });

  it("reconhece conteúdo por alterar entre execuções", async () => {
    const http = new PoliteHttp(0, respond({
      "https://x.pt/robots.txt": () => new Response(""),
      "https://x.pt/a": () => new Response("igual"),
    }), cacheDir());
    expect((await http.text("https://x.pt/a", { cache: true })).notModified).toBe(false);
    expect((await http.text("https://x.pt/a", { cache: true })).notModified).toBe(true);
  });
});
