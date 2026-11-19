import { csvResponse, toCsv } from "@/lib/csv";
import { listSummariesForExport } from "@/lib/queries/summaries";
import { SUMMARY_UNAVAILABLE } from "@/lib/summaries";

export const dynamic = "force-dynamic";

export async function GET() {
  const summaries = await listSummariesForExport();
  return csvResponse(
    "resumos-torres-vedras.csv",
    toCsv(
      ["Tipo", "Título", "Resumo simples", "O que significa", "Quem decidiu", "Estado", "Data", "Fonte oficial"],
      summaries.map((row) => [row.entityType, row.title, row.simple ?? SUMMARY_UNAVAILABLE, row.meaning, row.decidedBy, row.status, row.date, row.sourceUrl]),
    ),
  );
}
