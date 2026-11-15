import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StackedTable, type StackedColumn } from "@/components/StackedTable";
import { pageSections } from "@/components/labels";
import { contractWhere } from "@/lib/filters";

describe("pageSections", () => {
  it("gera a navegação e os ids a partir das mesmas chaves", () => {
    const { nav, id } = pageSections({ lista: "Lista", totais: "Totais" });
    expect(nav).toEqual([{ href: "#lista", label: "Lista" }, { href: "#totais", label: "Totais" }]);
    expect(id).toEqual({ lista: "lista", totais: "totais" });
  });
});

describe("StackedTable", () => {
  type Row = { id: string; name: string; value: number };
  const columns: StackedColumn<Row>[] = [
    { label: "Nome", cell: (row) => row.name },
    { label: "Valor", right: true, gap: 2, className: "w-20", cell: (row) => row.value },
  ];
  const html = renderToStaticMarkup(
    createElement(StackedTable<Row>, { caption: "Legenda", rows: [{ id: "a", name: "Alfa", value: 1 }, { id: "b", name: "Beta", value: 2 }], rowKey: (row) => row.id, columns }),
  );

  it("cria cabeçalhos, legenda e uma linha por registo", () => {
    expect(html).toContain('<caption class="sr-only">Legenda</caption>');
    expect(html.match(/<th /g)).toHaveLength(2);
    expect(html.match(/<tbody>.*<\/tbody>/s)?.[0].match(/<tr /g)).toHaveLength(2);
    expect(html).toContain("Alfa");
    expect(html).toContain("Beta");
  });

  it("aplica alinhamento, espaçamento e classes da coluna", () => {
    expect(html).toContain("text-right");
    expect(html).toContain("mt-2 md:mt-0");
    expect(html).toContain("w-20");
    expect(html).not.toContain("mt-1 md:mt-0");
  });
});

describe("contractWhere", () => {
  it("sem filtros não restringe nada", () => {
    expect(contractWhere({})).toEqual({
      signedAt: undefined,
      awardingNif: undefined,
      procedureType: undefined,
      supplierName: undefined,
      searchText: undefined,
    });
  });

  it("converte o ano num intervalo em UTC", () => {
    expect(contractWhere({ ano: "2024" }).signedAt).toEqual({ gte: new Date(Date.UTC(2024, 0, 1)), lt: new Date(Date.UTC(2025, 0, 1)) });
  });

  it("ignora anos inválidos", () => {
    expect(contractWhere({ ano: "24" }).signedAt).toBeUndefined();
    expect(contractWhere({ ano: "2024-01" }).signedAt).toBeUndefined();
  });

  it("passa entidade, procedimento e fornecedor tal como vêm", () => {
    const where = contractWhere({ entidade: "501234567", procedimento: "Ajuste direto", fornecedor: "ACME; Lda" });
    expect(where).toMatchObject({ awardingNif: "501234567", procedureType: "Ajuste direto", supplierName: "ACME; Lda" });
  });
});
