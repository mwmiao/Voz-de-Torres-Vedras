import { csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const KIND = { RESUMO: "Resumo", RECEITA: "Receita", DESPESA: "Despesa", SITUACAO_FINANCEIRA: "Situação financeira" };

export async function GET() {
  const entries = await db.budgetEntry.findMany({ include: { sources: true }, orderBy: [{ year: "desc" }, { kind: "asc" }, { asOf: "desc" }] });
  const rows = entries.map((entry) => [
    entry.year,
    KIND[entry.kind],
    entry.label,
    entry.amountEur.toString().replace(".", ","),
    entry.approximate ? "Sim" : "Não",
    entry.asOf,
    entry.note,
    entry.sources.map((source) => source.url).join(" "),
    entry.updatedAt,
  ]);
  return csvResponse(
    "orcamento-torres-vedras.csv",
    toCsv(["Ano", "Tipo", "Designação", "Valor (EUR)", "Valor aproximado", "Data de referência", "Nota", "Fonte oficial", "Última atualização"], rows),
  );
}
