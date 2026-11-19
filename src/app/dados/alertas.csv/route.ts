import { ALERT_TYPE_LABEL, SEVERITY_LABEL } from "@/lib/alerts";
import { csvResponse, toCsv } from "@/lib/csv";
import { listAlertsForExport } from "@/lib/queries/alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  const alerts = await listAlertsForExport();
  return csvResponse(
    "alertas-torres-vedras.csv",
    toCsv(
      ["Título", "Tipo", "Gravidade", "Área", "Início", "Fim", "Fim indicado na fonte", "Descrição", "Fonte oficial", "Publicação", "Verificado"],
      alerts.map((alert) => [
        alert.title, ALERT_TYPE_LABEL[alert.type], SEVERITY_LABEL[alert.severity], alert.geographicArea, alert.startsAt, alert.endsAt,
        alert.hasOfficialEnd ? "sim" : "não", alert.description, alert.sourceUrl, alert.publicationDate, alert.lastCheckedAt,
      ]),
    ),
  );
}
