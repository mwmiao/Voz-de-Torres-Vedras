import { csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { searchParamsObject } from "@/lib/filters";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = searchParamsObject(request.url);
  const records = await db.crimeRecord.findMany({
    where: { year: /^\d{4}$/.test(params.ano ?? "") ? Number(params.ano) : undefined, categoryCode: params.categoria || undefined },
    include: { category: true },
    orderBy: [{ year: "desc" }, { category: { order: "asc" } }],
  });
  const decimal = (value: number | null) => (value === null ? "" : String(value).replace(".", ","));
  return csvResponse(
    "seguranca-torres-vedras.csv",
    toCsv(
      ["Ano", "Área", "Tipo de área", "Categoria", "Contagem", "Valor oculto", "Taxa INE (‰)", "Taxa calculada por 1 000 residentes", "Ano da população", "Fonte oficial", "Publicação", "Recolha"],
      records.map((record) => [
        record.year, record.geographicArea, record.geographicAreaType, record.category.name, record.count, record.confidential ? "sim" : "não",
        decimal(record.officialRate), decimal(record.calculatedRate), record.populationYear, record.sourceUrl, record.publicationDate, record.retrievalDate,
      ]),
    ),
  );
}
