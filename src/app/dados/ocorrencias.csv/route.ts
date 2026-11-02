import { FREGUESIAS } from "@/lib/alerts";
import { csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { INCIDENT_CATEGORY_LABEL, PHASE_LABEL, PRECISION_LABEL, SOURCE_TIER_LABEL, SOURCE_TIER_NUMBER, VERIFICATION_LABEL } from "@/lib/incidents";

export const dynamic = "force-dynamic";

const NAMES = Object.fromEntries(FREGUESIAS.map((item) => [item.slug, item.name]));

/**
 * Inclui o arquivo: ocorrências com mais de 14 dias e as arquivadas por falta de confirmação, com o motivo.
 * Registos retidos para revisão não saem, e ligações com dados pessoais também não.
 */
export async function GET() {
  const incidents = await db.incident.findMany({ where: { heldForReview: false }, include: { references: true }, orderBy: { incidentStart: "desc" } });
  const list = (items: typeof incidents[number]["references"]) =>
    items.map((item) => `${item.sourceName} (nível ${SOURCE_TIER_NUMBER[item.sourceTier]}${item.duplicateOfUrl ? ", repetição" : ""})${item.linkPublic ? ` ${item.url}` : ""}`).join(" | ");
  return csvResponse(
    "ocorrencias-torres-vedras.csv",
    toCsv(
      [
        "Data da ocorrência", "Hora indicada na fonte", "Fim", "Tipo", "Etiquetas", "Resumo", "Freguesia", "Área", "Precisão",
        "Estado de verificação", "Relatos contraditórios", "Fase indicada na fonte", "Fonte", "Nível da fonte", "Autor", "Ligação",
        "Publicação", "Primeiro relato", "Última verificação", "Fontes que corroboram", "Fontes em conflito", "Revisão", "Arquivo",
      ],
      incidents.map((item) => [
        item.incidentStart, item.hasTime ? "sim" : "não", item.incidentEnd, INCIDENT_CATEGORY_LABEL[item.category], item.tags, item.summary,
        NAMES[item.freguesiaSlug] ?? item.freguesiaSlug, item.placeName, PRECISION_LABEL[item.precision],
        VERIFICATION_LABEL[item.verificationStatus], item.hasConflict ? "sim" : "não", item.phase ? PHASE_LABEL[item.phase] : "",
        item.sourceName, `${SOURCE_TIER_NUMBER[item.sourceTier]}: ${SOURCE_TIER_LABEL[item.sourceTier]}`, item.author,
        item.sourceLinkPublic ? item.sourceUrl : "(não publicada)", item.publicationDate, item.firstReportedAt, item.lastCheckedAt,
        list(item.references.filter((ref) => ref.agreement === "CORROBORA" || ref.agreement === "ACRESCENTA")),
        list(item.references.filter((ref) => ref.agreement === "CONTRADIZ")),
        item.reviewStatus === "PENDENTE" ? "pendente" : item.reviewStatus === "REVISTA" ? "revista" : "",
        item.archiveReason ?? "",
      ]),
    ),
  );
}
