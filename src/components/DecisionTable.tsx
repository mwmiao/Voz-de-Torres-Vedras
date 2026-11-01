import type { Decision, Meeting, Source, Summary } from "@prisma/client";
import Link from "next/link";
import { BODY_LABEL, formatDateShort, voteSummary } from "@/lib/format";
import { SummaryBlock } from "./civic";
import { LastUpdated, OutcomeBadge } from "./labels";
import { SourceChips } from "./Receipts";

export type DecisionRow = Decision & { meeting: Meeting; sources: Source[] };

/** Em ecrãs pequenos cada decisão é um bloco; em ecrãs largos, uma linha de tabela. */
export function DecisionList({ decisions, summaries }: { decisions: DecisionRow[]; summaries?: Map<string, Summary> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">Decisões municipais com resultado e fontes oficiais</caption>
        <thead className="hidden bg-paper text-xs text-muted md:table-header-group">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Data</th>
            <th scope="col" className="px-3 py-2 font-semibold">Órgão e ponto</th>
            <th scope="col" className="px-3 py-2 font-semibold">Decisão</th>
            <th scope="col" className="px-3 py-2 font-semibold">Resultado</th>
            <th scope="col" className="px-3 py-2 font-semibold">Fontes</th>
          </tr>
        </thead>
        <tbody>
          {decisions.map((decision) => (
            <tr key={decision.id} className="block border-t border-line p-3 first:border-t-0 md:table-row md:p-0">
              <td className="block whitespace-nowrap align-top text-muted md:table-cell md:px-3 md:py-3">
                <Link href={`/reunioes/${decision.meeting.slug}`} className="underline">{formatDateShort(decision.meeting.date)}</Link>
              </td>
              <td className="block align-top text-muted md:table-cell md:w-44 md:px-3 md:py-3">
                {BODY_LABEL[decision.meeting.body]}
                {decision.itemNumber ? ` · ponto ${decision.itemNumber}` : ""}
                {decision.proposalRef ? <span className="block text-xs">Proposta {decision.proposalRef}</span> : null}
              </td>
              <td className="mt-1 block align-top font-medium md:mt-0 md:table-cell md:px-3 md:py-3">
                {decision.title}
                {summaries?.get(decision.slug) ? (
                  <details className="mt-1 font-normal">
                    <summary className="cursor-pointer text-sm underline">Resumo simples</summary>
                    <div className="mt-2"><SummaryBlock summary={summaries.get(decision.slug)!} heading={false} /></div>
                  </details>
                ) : null}
                <LastUpdated date={decision.updatedAt} className="mt-1 font-normal" />
              </td>
              <td className="mt-2 block align-top md:mt-0 md:table-cell md:w-44 md:px-3 md:py-3">
                <OutcomeBadge outcome={decision.outcome} />
                {decision.outcome !== "POR_PUBLICAR" && decision.outcome !== "TOMADA_CONHECIMENTO" ? (
                  <span className="mt-1 block text-xs text-muted">{voteSummary(decision)}</span>
                ) : null}
                {decision.voteNote ? <span className="mt-1 block text-xs text-muted">{decision.voteNote}</span> : null}
              </td>
              <td className="mt-2 block align-top md:mt-0 md:table-cell md:w-40 md:px-3 md:py-3">
                <SourceChips sources={decision.sources} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
