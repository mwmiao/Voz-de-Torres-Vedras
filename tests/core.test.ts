import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";
import { contractOrder, decisionWhere, queryString } from "@/lib/filters";
import { formatEur, voteSummary } from "@/lib/format";
import { isPersonNif, normalizeBaseRecord, parseDate } from "@/lib/import/base";
import { parseRows, slugify, validateBudgetRows, validateDecisionRows } from "@/lib/import/records";
import { isAllowedByRobots } from "@/lib/robots";
import { isOfficialUrl, isVerified } from "@/lib/sources";

describe("fontes", () => {
  it("reconhece domínios oficiais e recusa imitações", () => {
    expect(isOfficialUrl("https://www.am-tvedras.pt/sessoes/atas/")).toBe(true);
    expect(isOfficialUrl("https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=1")).toBe(true);
    expect(isOfficialUrl("https://cm-tvedras.pt.exemplo.com/ata.pdf")).toBe(false);
    expect(isOfficialUrl("https://jornal-local.pt/noticia")).toBe(false);
    expect(isOfficialUrl("javascript:alert(1)")).toBe(false);
  });

  it("só aceita vídeo externo como tipo vídeo", () => {
    expect(isOfficialUrl("https://www.youtube.com/watch?v=1", "VIDEO")).toBe(true);
    expect(isOfficialUrl("https://www.youtube.com/watch?v=1", "DOCUMENTO_PDF")).toBe(false);
  });

  it("sem fonte oficial a afirmação fica não verificada", () => {
    expect(isVerified([])).toBe(false);
    expect(isVerified([{ official: false }])).toBe(false);
    expect(isVerified([{ official: false }, { official: true }])).toBe(true);
  });
});

describe("robots.txt", () => {
  const cm = "User-agent: *\nDisallow: /assets/upload\nDisallow: /ficheiros/\n";
  const am = "User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php\n";

  it("respeita as exclusões do site da Câmara", () => {
    expect(isAllowedByRobots(cm, "/assets/upload/documentos/ata.pdf")).toBe(false);
    expect(isAllowedByRobots(cm, "/documentos/editaisatas/atascm")).toBe(true);
  });

  it("aplica a regra mais específica", () => {
    expect(isAllowedByRobots(am, "/wp-admin/admin-ajax.php")).toBe(true);
    expect(isAllowedByRobots(am, "/wp-admin/x")).toBe(false);
  });
});

describe("Portal BASE", () => {
  const record = {
    idcontrato: "14019489",
    objectoContrato: "Empreitada &amp; obra",
    adjudicante: ["502173653 - Município de Torres Vedras"],
    adjudicatarios: ["504774697 - Joaquim Fernandes Marques &amp; Filho, S.A."],
    tipoprocedimento: "Concurso público",
    tipoContrato: ["Empreitadas de obras públicas"],
    dataCelebracaoContrato: "11/03/2026",
    precoContratual: 6329269.97,
    cpv: ["45214210-5 - Construção de escolas primárias"],
    prazoExecucao: 728,
  };

  it("normaliza um contrato municipal e liga ao portal", () => {
    const contract = normalizeBaseRecord(record);
    expect(contract?.supplierName).toBe("Joaquim Fernandes Marques & Filho, S.A.");
    expect(contract?.title).toBe("Empreitada & obra");
    expect(contract?.signedAt?.toISOString().slice(0, 10)).toBe("2026-03-11");
    expect(contract?.sourceUrl).toContain("id=14019489");
  });

  it("limpa caracteres de controlo vindos do Windows-1252", () => {
    const contract = normalizeBaseRecord({ ...record, objectoContrato: "Obra \u0096 Fase 1\u0002" });
    expect(contract?.title).toBe("Obra – Fase 1");
  });

  it("ignora outras entidades adjudicantes", () => {
    expect(normalizeBaseRecord({ ...record, adjudicante: ["600085473 - Agrupamento de Escolas"] })).toBeNull();
  });

  it("não republica identificação de pessoas singulares", () => {
    const contract = normalizeBaseRecord({ ...record, adjudicatarios: ["212345678 - Maria Exemplo"] });
    expect(contract?.supplierIsPerson).toBe(true);
    expect(contract?.supplierName).not.toContain("Maria");
    expect(contract?.supplierNif).toBeNull();
  });

  it("reconhece NIF e datas", () => {
    expect(isPersonNif("212345678")).toBe(true);
    expect(isPersonNif("502173653")).toBe(false);
    expect(parseDate("31-12-2026")).toBeNull();
  });
});

describe("importação", () => {
  const row = {
    body: "ASSEMBLEIA_MUNICIPAL",
    meetingDate: "2026-06-24",
    meetingTitle: "Sessão ordinária",
    title: "Moção de teste",
    outcome: "APROVADO",
    voteMode: "MAIORIA",
    sourceName: "Assembleia Municipal",
    sourceTitle: "Edital n.º 10/2026",
    sourceUrl: "https://www.am-tvedras.pt/edital.pdf",
    sourceType: "EDITAL",
  };

  it("aceita uma decisão com fonte oficial", () => {
    expect(validateDecisionRows([row]).valid).toHaveLength(1);
  });

  it("recusa decisões sem fonte oficial", () => {
    const { valid, errors } = validateDecisionRows([{ ...row, sourceUrl: "https://blog.exemplo.pt/x" }]);
    expect(valid).toHaveLength(0);
    expect(errors[0].row).toBe(1);
    expect(errors[0].message).toContain("sourceUrl");
  });

  it("valida valores orçamentais e exige fonte oficial", () => {
    const budget = {
      year: "2026",
      kind: "DESPESA",
      label: "Pessoal",
      amountEur: "1000.50",
      approximate: "true",
      sourceName: "Câmara Municipal",
      sourceTitle: "Orçamento da Despesa",
      sourceUrl: "https://www.cm-tvedras.pt/documentos/gestao/",
    };
    const ok = validateBudgetRows([budget]);
    expect(ok.valid[0]).toMatchObject({ year: 2026, amountEur: 1000.5, approximate: true });
    expect(validateBudgetRows([{ ...budget, sourceUrl: "https://blog.exemplo.pt" }]).errors).toHaveLength(1);
  });

  it("lê CSV com BOM e acentos", () => {
    const rows = parseRows("d.csv", "﻿body,title\nASSEMBLEIA_MUNICIPAL,Moção\n");
    expect(rows[0]).toEqual({ body: "ASSEMBLEIA_MUNICIPAL", title: "Moção" });
  });

  it("gera identificadores legíveis", () => {
    expect(slugify("Proteção Civil — 2.ª fase")).toBe("protecao-civil-2-fase");
  });
});

describe("exportação CSV", () => {
  it("usa ponto e vírgula, BOM e aspas quando necessário", () => {
    const csv = toCsv(["Objeto", "Valor"], [['Obra; "fase" 1', 10]]);
    expect(csv.startsWith("﻿Objeto;Valor\r\n")).toBe(true);
    expect(csv).toContain('"Obra; ""fase"" 1";10');
  });

  it("escreve datas ISO e células vazias", () => {
    expect(toCsv(["D", "V"], [[new Date("2026-03-11T12:00:00Z"), null]])).toContain("2026-03-11;");
  });

  it("neutraliza fórmulas de folhas de cálculo", () => {
    expect(toCsv(["A"], [["=SOMA(A1)"]])).toContain("'=SOMA(A1)");
  });
});

describe("filtros", () => {
  it("só mostra decisões com fonte oficial e ignora valores inválidos", () => {
    const where = decisionWhere({ orgao: "INVENTADO", resultado: "X", ano: "abc" });
    expect(where.sources).toEqual({ some: { official: true } });
    expect(where.outcome).toBeUndefined();
    expect(where.OR).toBeUndefined();
  });

  it("filtra por ano", () => {
    const where = decisionWhere({ ano: "2026" });
    expect(where.meeting).toMatchObject({ date: { gte: new Date(Date.UTC(2026, 0, 1)) } });
  });

  it("ordena contratos por valor", () => {
    expect(contractOrder({ ordem: "valor" })).toEqual({ priceEur: "desc" });
  });

  it("omite parâmetros vazios", () => {
    expect(queryString({ q: "", ordem: "valor" }, { pagina: "2" })).toBe("ordem=valor&pagina=2");
  });
});

describe("formatação", () => {
  it("usa pt-PT", () => {
    expect(formatEur(1234.5).replace(/\s/g, " ")).toBe("1 234,50 €");
  });

  it("nunca inventa contagens de votos", () => {
    expect(voteSummary({ voteMode: "MAIORIA", votesFor: null, votesAgainst: null, abstentions: null })).toContain("não publicada");
    expect(voteSummary({ voteMode: "MAIORIA", votesFor: 41, votesAgainst: 0, abstentions: 1 })).toBe("41 a favor · 0 contra · 1 abstenção");
  });
});
