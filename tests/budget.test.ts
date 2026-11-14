import { describe, expect, it } from "vitest";
import { budgetOverview } from "../src/lib/budget-copy";
import { cashHistory, latestFinancialFacts } from "../src/lib/budget-facts";
import { groupBudgetDocs } from "../src/lib/budget-docs";

const fact = (label: string, amountEur: number, asOf: string | null, note: string | null = null) => ({ label, amountEur, asOf: asOf ? new Date(asOf) : null, note });

describe("orçamento", () => {
  const financial = [
    fact("Disponibilidades", 5, "2025-06-30"),
    fact("Total de disponibilidades", 6_000_000, "2025-06-30"),
    fact("Limite da dívida total", 40_000_000, "2025-06-30"),
    fact("Dívida total da autarquia", 10_000_000, "2025-06-30", "incompleta"),
    fact("Dívida total da autarquia", 99, "2024-12-31"),
    fact("Total de disponibilidades", 1_000_000, "2024-12-31"),
  ];

  it("escolhe a data mais recente e ordena para leitura", () => {
    const { asOf, facts } = latestFinancialFacts(financial);
    expect(asOf).toEqual(new Date("2025-06-30"));
    expect(facts.map((item) => item.label)).toEqual(["Dívida total da autarquia", "Limite da dívida total", "Disponibilidades", "Total de disponibilidades"]);
  });

  it("sem datas mostra tudo e deixa a data por indicar", () => {
    const undated = [fact("Limite da dívida total", 1, null), fact("Dívida total da autarquia", 1, null)];
    const { asOf, facts } = latestFinancialFacts(undated);
    expect(asOf).toBeUndefined();
    expect(facts.map((item) => item.label)).toEqual(["Dívida total da autarquia", "Limite da dívida total"]);
  });

  it("lista o dinheiro em caixa do mais antigo para o mais recente", () => {
    expect(cashHistory(financial).map((item) => item.amountEur)).toEqual([1_000_000, 6_000_000]);
  });

  it("escreve só as frases que têm valores", () => {
    const { asOf, facts } = latestFinancialFacts(financial);
    const summary = [fact("Orçamento da Câmara", 100_000_000, null), fact("Orçamento dos SMAS", 20_000_000, null)];
    const lines = budgetOverview({ summary, year: 2025, facts, asOf });
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("O orçamento de 2025 soma cerca de 120 milhões de euros: Câmara, 100 milhões de euros; SMAS, 20 milhões de euros.");
    expect(lines[1]).toContain("25%");
    expect(lines[1]).toContain("incompleto");
    expect(budgetOverview({ summary: [], year: undefined, facts: [], asOf: undefined })).toEqual([]);
  });

  it("agrupa os documentos pelo prefixo do título", () => {
    const groups = groupBudgetDocs([
      { id: "1", url: "u1", title: "2025, Contas: Balanço" },
      { id: "2", url: "u2", title: "2025, Contas: Anexos" },
      { id: "3", url: "u3", title: "Sem prefixo" },
    ]);
    expect(groups.map((group) => [group.group, group.items.map((item) => item.label)])).toEqual([
      ["2025, Contas", ["Balanço", "Anexos"]],
      ["Outros documentos", ["Sem prefixo"]],
    ]);
  });
});
