import { csvResponse, toCsv } from "@/lib/csv";
import { listMetricsForExport } from "@/lib/queries/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const metrics = await listMetricsForExport();
  return csvResponse(
    "metricas-torres-vedras.csv",
    toCsv(
      ["Métrica", "Subdivisão", "Período", "Valor", "Unidade", "Área", "Fonte", "Recolha"],
      metrics.map((metric) => [metric.key, metric.dimension, metric.period, String(metric.value).replace(".", ","), metric.unit, metric.geographicArea, metric.sourceUrl, metric.retrievalDate]),
    ),
  );
}
