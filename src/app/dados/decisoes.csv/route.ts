import { csvResponse, toCsv } from "@/lib/csv";
import { decisionOrder, decisionWhere, searchParamsObject } from "@/lib/filters";
import { BODY_LABEL, OUTCOME_LABEL, voteSummary } from "@/lib/format";
import { listDecisionsForExport } from "@/lib/queries/meetings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = searchParamsObject(request.url);
  const decisions = await listDecisionsForExport(decisionWhere(params), decisionOrder(params));
  const rows = decisions.map((decision) => [
    decision.meeting.date,
    BODY_LABEL[decision.meeting.body],
    decision.itemNumber,
    decision.proposalRef,
    decision.title,
    OUTCOME_LABEL[decision.outcome],
    voteSummary(decision),
    decision.voteNote,
    decision.sources.map((source) => source.url).join(" "),
    decision.updatedAt,
  ]);
  return csvResponse(
    "decisoes-torres-vedras.csv",
    toCsv(["Data", "Órgão", "Ponto", "Proposta", "Decisão", "Resultado", "Votação", "Sentido de voto", "Fontes oficiais", "Última atualização"], rows),
  );
}
