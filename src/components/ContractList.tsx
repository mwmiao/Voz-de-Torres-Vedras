import type { Contract, ContractModification, Source, Summary } from "@prisma/client";
import Link from "next/link";
import { displayTitle } from "@/lib/display-title";
import { formatDate, formatEur } from "@/lib/format";
import { SummaryBlock } from "./civic";
import { SourceChips } from "./Receipts";
import { StackedTable, type StackedColumn } from "./StackedTable";

export type ContractRow = Contract & { modifications: ContractModification[]; sources: Source[] };

type Props = {
  contracts: ContractRow[];
  summaries: Map<string, Summary>;
  /** Fornecedor já escolhido no filtro: o seu nome não é ligação. */
  currentSupplier?: string;
  supplierHref: (name: string) => string;
};

export function ContractList({ contracts, summaries, currentSupplier, supplierHref }: Props) {
  const columns: StackedColumn<ContractRow>[] = [
    {
      label: "Data",
      className: "whitespace-nowrap text-muted",
      cell: (contract) => (contract.signedAt ? formatDate(contract.signedAt) : "Data não indicada"),
    },
    {
      label: "Contrato",
      gap: 1,
      cell: (contract) => {
        const summary = summaries.get(contract.baseId);
        return (
          <>
            <span className="font-medium [overflow-wrap:anywhere]">{displayTitle(contract.title)}</span>
            <span className="mt-0.5 block text-xs text-muted">{contract.procedureType} · {contract.awardingBody}</span>
            {contract.modifications.map((modification) => (
              <span key={modification.id} className="mt-0.5 block text-xs text-muted">
                Modificação{modification.date ? ` de ${formatDate(modification.date)}` : ""}
                {modification.newPriceEur ? `: novo valor ${formatEur(modification.newPriceEur)}` : ""}
              </span>
            ))}
            {summary ? (
              <details className="mt-1">
                <summary className="cursor-pointer text-sm underline">Resumo simples</summary>
                <div className="mt-2"><SummaryBlock summary={summary} heading={false} /></div>
              </details>
            ) : null}
          </>
        );
      },
    },
    {
      label: "Fornecedor",
      gap: 1,
      className: "md:w-56",
      cell: (contract) => (
        <>
          <span className="text-muted md:hidden">Fornecedor: </span>
          {contract.supplierIsPerson || currentSupplier === contract.supplierName
            ? contract.supplierName
            : <Link href={supplierHref(contract.supplierName)} className="underline" title="Ver todos os contratos deste fornecedor">{contract.supplierName}</Link>}
        </>
      ),
    },
    { label: "Valor", right: true, gap: 1, className: "whitespace-nowrap font-semibold tabular-nums", cell: (contract) => formatEur(contract.priceEur) },
    { label: "Fonte", gap: 2, cell: (contract) => <SourceChips sources={contract.sources} /> },
  ];

  return <StackedTable caption="Contratos, com data, objeto, fornecedor, procedimento, valor e fonte" rows={contracts} rowKey={(contract) => contract.id} columns={columns} />;
}
