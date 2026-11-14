import type { Decision, Meeting, Source, Summary } from "@prisma/client";
import Link from "next/link";
import { BODY_LABEL, formatDate, voteSummary } from "@/lib/format";
import { SummaryBlock } from "./civic";
import { LastUpdated, OutcomeBadge } from "./labels";
import { SourceChips } from "./Receipts";
import { StackedTable, type StackedColumn } from "./StackedTable";

export type DecisionRow = Decision & { meeting: Meeting; sources: Source[] };

/** Em ecrãs pequenos cada decisão é um bloco; em ecrãs largos, uma linha de tabela. */
export function DecisionList({ decisions, summaries }: { decisions: DecisionRow[]; summaries?: Map<string, Summary> }) {
  const columns: StackedColumn<DecisionRow>[] = [
    {
      label: "Data",
      className: "whitespace-nowrap text-muted",
      cell: (decision) => <Link href={`/reunioes/${decision.meeting.slug}`} className="underline">{formatDate(decision.meeting.date)}</Link>,
    },
    {
      label: "Órgão e ponto",
      className: "text-muted md:w-44",
      cell: (decision) => (
        <>
          {BODY_LABEL[decision.meeting.body]}
          {decision.itemNumber ? ` · ponto ${decision.itemNumber}` : ""}
          {decision.proposalRef ? <span className="block text-xs">Proposta {decision.proposalRef}</span> : null}
        </>
      ),
    },
    {
      label: "Decisão",
      gap: 1,
      className: "font-medium",
      cell: (decision) => {
        const summary = summaries?.get(decision.slug);
        return (
          <>
            {decision.title}
            {summary ? (
              <details className="mt-1 font-normal">
                <summary className="cursor-pointer text-sm underline">Resumo simples</summary>
                <div className="mt-2"><SummaryBlock summary={summary} heading={false} /></div>
              </details>
            ) : null}
            <LastUpdated date={decision.updatedAt} className="mt-1 font-normal" />
          </>
        );
      },
    },
    {
      label: "Resultado",
      gap: 2,
      className: "md:w-44",
      cell: (decision) => (
        <>
          <OutcomeBadge outcome={decision.outcome} />
          {decision.outcome !== "POR_PUBLICAR" && decision.outcome !== "TOMADA_CONHECIMENTO" ? (
            <span className="mt-1 block text-xs text-muted">{voteSummary(decision)}</span>
          ) : null}
          {decision.voteNote ? <span className="mt-1 block text-xs text-muted">{decision.voteNote}</span> : null}
        </>
      ),
    },
    { label: "Fontes", gap: 2, className: "md:w-40", cell: (decision) => <SourceChips sources={decision.sources} /> },
  ];

  return <StackedTable caption="Decisões municipais com resultado e fontes oficiais" rows={decisions} rowKey={(decision) => decision.id} columns={columns} />;
}
