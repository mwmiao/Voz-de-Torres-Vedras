import type { Decision, Meeting, Source, Summary } from "@prisma/client";
import Link from "next/link";
import { BODY_LABEL, formatDate, voteSummary } from "@/lib/format";
import { SummaryBlock } from "./civic";
import { LastUpdated, OutcomeBadge } from "./labels";
import { SourceChips } from "./Receipts";
import { StackedCell, StackedRow, StackedTable } from "./StackedTable";

const COLUMNS = [{ label: "Data" }, { label: "Órgão e ponto" }, { label: "Decisão" }, { label: "Resultado" }, { label: "Fontes" }];

export type DecisionRow = Decision & { meeting: Meeting; sources: Source[] };

/** Em ecrãs pequenos cada decisão é um bloco; em ecrãs largos, uma linha de tabela. */
export function DecisionList({ decisions, summaries }: { decisions: DecisionRow[]; summaries?: Map<string, Summary> }) {
  return (
    <StackedTable caption="Decisões municipais com resultado e fontes oficiais" columns={COLUMNS}>
      {decisions.map((decision) => (
        <StackedRow key={decision.id}>
          <StackedCell className="whitespace-nowrap text-muted">
            <Link href={`/reunioes/${decision.meeting.slug}`} className="underline">{formatDate(decision.meeting.date)}</Link>
          </StackedCell>
          <StackedCell className="text-muted md:w-44">
            {BODY_LABEL[decision.meeting.body]}
            {decision.itemNumber ? ` · ponto ${decision.itemNumber}` : ""}
            {decision.proposalRef ? <span className="block text-xs">Proposta {decision.proposalRef}</span> : null}
          </StackedCell>
          <StackedCell gap={1} className="font-medium">
            {decision.title}
            {summaries?.get(decision.slug) ? (
              <details className="mt-1 font-normal">
                <summary className="cursor-pointer text-sm underline">Resumo simples</summary>
                <div className="mt-2"><SummaryBlock summary={summaries.get(decision.slug)!} heading={false} /></div>
              </details>
            ) : null}
            <LastUpdated date={decision.updatedAt} className="mt-1 font-normal" />
          </StackedCell>
          <StackedCell gap={2} className="md:w-44">
            <OutcomeBadge outcome={decision.outcome} />
            {decision.outcome !== "POR_PUBLICAR" && decision.outcome !== "TOMADA_CONHECIMENTO" ? (
              <span className="mt-1 block text-xs text-muted">{voteSummary(decision)}</span>
            ) : null}
            {decision.voteNote ? <span className="mt-1 block text-xs text-muted">{decision.voteNote}</span> : null}
          </StackedCell>
          <StackedCell gap={2} className="md:w-40"><SourceChips sources={decision.sources} /></StackedCell>
        </StackedRow>
      ))}
    </StackedTable>
  );
}
