import { describe, expect, it } from "vitest";
import { classifyAlert, detectFreguesias, parseCmCivilProtection, parseCmNoticeList, parseIpmaWarnings, parsePeriod, parseSmasDetail, parseSmasList } from "../ingestion/parsers/alertas";
import { ineRows, parseCrimeYear, parsePopulation } from "../ingestion/parsers/ine";
import { validateRecord } from "../ingestion/validators";
import { isPersonSupplier } from "../src/lib/import/base";
import { CRIME_DISCLAIMER, panorama, rateOf, type CrimeRow } from "../src/lib/safety";
import { isClearTitle, summarizeContract, summarizeDecision, summarizeSource } from "../src/lib/summaries";
import { compareValues } from "../src/lib/trends";

const published = new Date("2026-10-28T12:00:00Z");
const day = (date: Date | null) => date?.toISOString().slice(0, 10);

describe("períodos de avisos", () => {
  it("lê um intervalo com anos diferentes", () => {
    const period = parsePeriod("entre 2 de novembro de 2026 e 31 de janeiro de 2027", published);
    expect([day(period.startsAt), day(period.endsAt)]).toEqual(["2026-11-02", "2027-01-31"]);
  });

  it("lê um intervalo no mesmo mês, sem ano", () => {
    const period = parsePeriod("está suspenso entre 18 e 31 de agosto", new Date("2026-08-10T12:00:00Z"));
    expect([day(period.startsAt), day(period.endsAt)]).toEqual(["2026-08-18", "2026-08-31"]);
  });

  it("lê um único dia", () => {
    const period = parsePeriod("será interrompido no próximo dia 31 de outubro, sábado", published);
    expect([day(period.startsAt), day(period.endsAt)]).toEqual(["2026-10-31", "2026-10-31"]);
  });

  it("não escolhe uma data quando o aviso reúne vários casos", () => {
    const text = "Rua A, dia 2 de novembro. Rua B, dia 5 de novembro. Rua C, entre 7 de novembro e 31 de janeiro.";
    expect(parsePeriod(text, published)).toEqual({ startsAt: null, endsAt: null });
  });

  it("não inventa datas", () => {
    expect(parsePeriod("Comunicado sobre o orçamento participativo", published)).toEqual({ startsAt: null, endsAt: null });
  });

  it("passa para o ano seguinte quando a data sem ano já seria muito antiga", () => {
    expect(day(parsePeriod("no dia 5 de janeiro", new Date("2026-12-20T12:00:00Z")).endsAt)).toBe("2027-01-05");
  });
});

describe("classificação de avisos", () => {
  it("reconhece água, trânsito e serviços", () => {
    expect(classifyAlert("Interrupção Programada do abastecimento de água", "")).toEqual({ type: "AGUA", severity: "ATENCAO" });
    expect(classifyAlert("Corte de trânsito no CM 1387", "")).toEqual({ type: "MOBILIDADE", severity: "ATENCAO" });
    expect(classifyAlert("Encerramento da Loja do Cidadão", "")).toEqual({ type: "SERVICOS", severity: "INFORMATIVO" });
  });

  it("só refere freguesias nomeadas no texto", () => {
    expect(detectFreguesias("Interrupção em Concelhos, Murteira, Asseiceira e Freiria")).toEqual(["Freiria"]);
    expect(detectFreguesias("Aviso para todo o território")).toEqual([]);
  });
});

describe("IPMA", () => {
  const warning = { text: "", awarenessTypeName: "Vento", idAreaAviso: "LSB", startTime: "2026-11-02T06:00:00", endTime: "2026-11-02T18:00:00", awarenessLevelID: "yellow" };

  it("ignora o nível verde e outros distritos", () => {
    expect(parseIpmaWarnings([{ ...warning, awarenessLevelID: "green" }, { ...warning, idAreaAviso: "PTO" }])).toEqual([]);
  });

  it("traduz o nível e mantém a origem oficial", () => {
    const [alert] = parseIpmaWarnings([{ ...warning, awarenessLevelID: "red" }]);
    expect(alert).toMatchObject({ severity: "CRITICO", type: "METEOROLOGIA", hasOfficialEnd: true });
    expect(validateRecord(alert)).toEqual([]);
  });
});

describe("páginas de avisos", () => {
  it("lê a lista da Câmara", () => {
    const html = `<div class="articles-list-item"><article><a href="/artigos/detalhes/corte"><h3>Corte de trânsito</h3></a><p class="articles-list-item__date">28.10.2026</p></article></div>`;
    expect(parseCmNoticeList(html)).toEqual([{ url: "https://www.cm-tvedras.pt/artigos/detalhes/corte", title: "Corte de trânsito", published }]);
  });

  it("lê comunicados da Proteção Civil sem abrir os PDF", () => {
    const html = `<a href="/assets/upload/prociv-comunicados/2026/07/01/a.pdf">Aviso Meteorológico N.º 11/2026 - Tempo Quente - 2026-07-01</a>`;
    const [alert] = parseCmCivilProtection(html, "https://www.cm-tvedras.pt/outros/prociv/avisos/");
    expect(alert).toMatchObject({ title: "Aviso Meteorológico N.º 11/2026 - Tempo Quente", hasOfficialEnd: false });
  });

  it("lê um aviso dos SMAS", () => {
    const html = `<body><main>Corte de trânsito no CM 1387 Ouvir 02 Novembro 2026 O trânsito estará encerrado entre 2 de novembro de 2026 e 31 de janeiro de 2027. Voltar Partilhar no Facebook</main></body>`;
    expect(parseSmasDetail(html, "https://www.smastv.pt/x/anuncio/corte", published)).toMatchObject({ title: "Corte de trânsito no CM 1387", type: "MOBILIDADE", hasOfficialEnd: true });
    const noisy = `<body>Utilizamos cookies. voltar ao topo da página Interrupção de água Ouvir 31 Outubro 2026 Texto do aviso. Voltar Partilhar</body>`;
    expect(parseSmasDetail(noisy, "https://www.smastv.pt/x/anuncio/agua", published)?.title).toBe("Interrupção de água");
    expect(parseSmasList(`<a href="/cliente/x/anuncio/a">a</a><a href="/cliente/x/anuncio/a">a</a>`)).toEqual(["https://www.smastv.pt/cliente/x/anuncio/a"]);
  });

  it("recusa avisos sem fonte oficial", () => {
    const [alert] = parseIpmaWarnings([{ text: "", awarenessTypeName: "Vento", idAreaAviso: "LSB", startTime: "2026-11-02T06:00:00", endTime: "2026-11-02T18:00:00", awarenessLevelID: "yellow" }]);
    expect(validateRecord({ ...alert, sourceUrl: "https://facebook.com/rumor" })).toContain("campo em falta ou inválido: sourceUrl");
  });
});

describe("dados do INE", () => {
  it("junta contagens e taxas, e assinala valores ocultos", () => {
    const records = parseCrimeYear({
      year: 2025,
      counts: [{ dim_3: "T", valor: "2244" }, { dim_3: "2", valor: "1130" }, { dim_3: "111", sinal_conv: "x" }, { dim_3: "999", valor: "1" }],
      rates: [{ dim_3: "T", valor: "24.5" }, { dim_3: "6", valor: "12.3" }],
      countIndicator: "0012261",
      publishedAt: null,
    });
    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({ categoryCode: "T", count: 2244, officialRate: 24.5 });
    expect(records[1]).toMatchObject({ categoryCode: "2", officialRate: 12.3 });
    expect(records[2]).toMatchObject({ categoryCode: "111", count: null, confidential: true });
    expect(records.map(validateRecord).flat()).toEqual([]);
  });

  it("falha quando o INE não devolve dados", () => {
    expect(() => ineRows([{ Sucesso: { Falso: [] } }], 2025)).toThrow("sem dados");
  });

  it("usa o total de residentes", () => {
    expect(parsePopulation([{ dim_3: "H", dim_4: "T", valor: "1" }, { dim_3: "T", dim_4: "T", valor: "85000" }], 2025, "0012918", null)?.population).toBe(85000);
  });
});

describe("fornecedores", () => {
  it("não publica pessoas singulares com NIF mascarado", () => {
    expect(isPersonSupplier("-", "Maria João Exemplo")).toBe(true);
    expect(isPersonSupplier("212345678", "Ana Exemplo")).toBe(true);
    expect(isPersonSupplier("-", "Exemplo & Filhos, Limitada")).toBe(false);
    expect(isPersonSupplier("503393800", "ATV - Académico de Torres Vedras")).toBe(false);
  });
});

describe("variações", () => {
  it("usa só linguagem neutra", () => {
    expect(compareValues(110, 100, "2024")).toEqual({ direction: "up", text: "aumentou 10% face a 2024" });
    expect(compareValues(90, 100).text).toBe("diminuiu 10%");
    expect(compareValues(100.5, 100).text).toBe("manteve-se estável");
    expect(compareValues(10, null).text).toBe("sem dados comparáveis");
    expect(compareValues(10, 0).text).toBe("sem dados comparáveis");
  });
});

describe("segurança", () => {
  const row = (categoryCode: string, name: string, year: number, count: number | null) => ({ categoryCode, year, count, category: { name } }) as CrimeRow;

  it("prefere a taxa oficial", () => {
    expect(rateOf({ officialRate: 2, calculatedRate: 3 })).toEqual({ value: 2, official: true });
    expect(rateOf({ officialRate: null, calculatedRate: 3 })).toEqual({ value: 3, official: false });
  });

  it("descreve tendências sem classificar nem explicar causas", () => {
    const text = panorama([row("T", "Total", 2025, 2244), row("T", "Total", 2024, 2300), row("12194", "Violência doméstica", 2025, 178), row("12194", "Violência doméstica", 2024, 133)], 85000).join(" ");
    expect(text).toContain("diminuiu");
    expect(text).toContain("aumentou");
    expect(text).not.toMatch(/perigos|segur[oa]\b|grave|preocupante|melhor|pior|culpa/i);
  });

  it("mantém o aviso de cautela exigido", () => {
    expect(CRIME_DISCLAIMER).toBe("As estatísticas criminais devem ser interpretadas com cautela e não provam, por si só, alterações reais na segurança pública.");
  });
});

describe("resumos", () => {
  const decision = {
    slug: "d",
    title: "Taxa de IMI para 2026.",
    outcome: "APROVADO" as const,
    voteMode: "UNANIMIDADE" as const,
    votesFor: null,
    votesAgainst: null,
    abstentions: null,
    proposalRef: "1/CM/2026",
    meeting: { slug: "am-2026-01-01", body: "ASSEMBLEIA_MUNICIPAL" as const, date: new Date("2026-01-15T12:00:00Z") },
    sources: [{ url: "https://www.am-tvedras.pt/edital.pdf", official: true }],
  };

  it("separa factos de contexto e liga à fonte", () => {
    const summary = summarizeDecision(decision)!;
    expect(summary.simple).toContain("aprovou");
    expect(summary.simple).toContain("Unanimidade");
    expect(summary.meaning).toContain("imposto");
    expect(summary.sourceUrl).toBe(decision.sources[0].url);
    expect(summary.status).toBe("Aprovado");
    expect(summary.simple?.split(/\.\s/).length).toBeLessThanOrEqual(4);
  });

  it("não cria resumo sem fonte oficial", () => {
    expect(summarizeDecision({ ...decision, sources: [] })).toBeNull();
  });

  it("não afirma o resultado de uma deliberação por publicar", () => {
    const summary = summarizeDecision({ ...decision, outcome: "POR_PUBLICAR" })!;
    expect(summary.simple).toContain("ainda não está publicada");
    expect(summary.simple).not.toContain("aprovou");
  });

  it("não republica o nome de pessoas singulares", () => {
    const summary = summarizeContract({
      baseId: "1", title: "Aquisição de serviços de consultoria jurídica", awardingBody: "Município de Torres Vedras", supplierName: "Nome Privado",
      supplierIsPerson: true, procedureType: "Ajuste Direto Regime Geral", priceEur: 1000 as never, signedAt: null, durationDays: null,
      sources: [{ url: "https://www.base.gov.pt/x", official: true }],
    })!;
    expect(summary.simple).not.toContain("Nome Privado");
  });

  it("recusa títulos ambíguos", () => {
    expect(isClearTitle("AM2021_EDITAL 13")).toBe(false);
    expect(isClearTitle("Documento da Assembleia Municipal (10-27)")).toBe(false);
    expect(isClearTitle("Regulamento de atribuição das medalhas municipais")).toBe(true);
    const summary = summarizeSource({ url: "https://www.am-tvedras.pt/a.pdf", title: "AM2021_EDITAL 13", name: "Assembleia Municipal", type: "EDITAL", publishedAt: null, official: true, data: null })!;
    expect(summary.available).toBe(false);
    expect(summary.simple).toBeNull();
    expect(summary.sourceUrl).toBe("https://www.am-tvedras.pt/a.pdf");
  });
});
