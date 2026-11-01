import { csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { SUMMARY_UNAVAILABLE } from "@/lib/summaries";

export const dynamic = "force-dynamic";

export async function GET() {
  const summaries = await db.summary.findMany({ orderBy: { date: { sort: "desc", nulls: "last" } } });
  return csvResponse(
    "resumos-torres-vedras.csv",
    toCsv(
      ["Tipo", "Título", "Resumo simples", "O que significa", "Quem decidiu", "Estado", "Data", "Fonte oficial"],
      summaries.map((row) => [row.entityType, row.title, row.simple ?? SUMMARY_UNAVAILABLE, row.meaning, row.decidedBy, row.status, row.date, row.sourceUrl]),
    ),
  );
}
