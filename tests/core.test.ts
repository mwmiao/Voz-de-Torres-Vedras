import { describe, expect, it } from "vitest";
import { buildAggregate } from "@/lib/aggregate";
import { hashEmail, hashIp, isDisposableEmail, normalizeEmail } from "@/lib/privacy";
import { isAllowedByRobots } from "@/lib/robots";
import { isOfficialUrl, isVerified } from "@/lib/sources";
import { formatEur, voteSummary } from "@/lib/format";
import { isPersonNif, normalizeBaseRecord, parseDate } from "@/lib/import/base";
import { parseRows, slugify, validateDecisionRows } from "@/lib/import/records";

describe("agregados", () => {
  const options = [
    { id: "a", label: "Concordo", count: 2 },
    { id: "b", label: "Discordo", count: 1 },
    { id: "c", label: "Preciso de mais informação", count: 1 },
  ];

  it("não revela contagens nem total abaixo do mínimo", () => {
    const result = buildAggregate(options, 10);
    expect(result.visible).toBe(false);
    expect(JSON.stringify(result)).not.toContain("count");
    expect(result.total).toBeNull();
  });

  it("mostra percentagens que somam 100", () => {
    const result = buildAggregate([
      { id: "a", label: "A", count: 1 },
      { id: "b", label: "B", count: 1 },
      { id: "c", label: "C", count: 1 },
    ], 3);
    if (!result.visible) throw new Error("devia estar visível");
    expect(result.rows.reduce((sum, row) => sum + row.percent, 0)).toBe(100);
    expect(result.total).toBe(3);
  });
});

describe("privacidade", () => {
  it("agrupa variantes da mesma caixa de correio", () => {
    expect(normalizeEmail(" Ana.Silva+voz@GoogleMail.com ")).toBe("anasilva@gmail.com");
    expect(normalizeEmail("ana.silva@sapo.pt")).toBe("ana.silva@sapo.pt");
    expect(normalizeEmail("invalido")).toBe("");
  });

  it("não guarda o email nem repete o hash de IP entre dias", () => {
    expect(hashEmail("ana@sapo.pt")).not.toContain("ana");
    expect(hashIp("1.2.3.4", new Date("2026-11-01"))).not.toBe(hashIp("1.2.3.4", new Date("2026-11-02")));
  });

  it("recusa domínios descartáveis", () => {
    expect(isDisposableEmail("a@mailinator.com")).toBe(true);
    expect(isDisposableEmail("a@sapo.pt")).toBe(false);
  });
});

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

describe("importação de decisões", () => {
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

  it("lê CSV com BOM e acentos", () => {
    const rows = parseRows("d.csv", "﻿body,title\nASSEMBLEIA_MUNICIPAL,Moção\n");
    expect(rows[0]).toEqual({ body: "ASSEMBLEIA_MUNICIPAL", title: "Moção" });
  });

  it("gera identificadores legíveis", () => {
    expect(slugify("Proteção Civil — 2.ª fase")).toBe("protecao-civil-2-fase");
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
