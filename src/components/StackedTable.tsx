import type { ReactNode } from "react";

/**
 * Lista de registos que, em ecrãs pequenos, mostra cada registo como um bloco
 * e, em ecrãs largos, como uma linha de tabela com cabeçalhos.
 */
export function StackedTable({ caption, columns, children }: { caption: string; columns: { label: string; right?: boolean }[]; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="hidden bg-paper text-xs text-muted md:table-header-group">
          <tr>
            {columns.map((column) => (
              <th key={column.label} scope="col" className={`px-3 py-2 font-semibold${column.right ? " text-right" : ""}`}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function StackedRow({ children }: { children: ReactNode }) {
  return <tr className="block border-t border-line p-3 first:border-t-0 md:table-row md:p-0">{children}</tr>;
}

// Classes escritas por extenso para o Tailwind as encontrar.
const GAP = { 1: "mt-1 md:mt-0", 2: "mt-2 md:mt-0" } as const;

/** `gap`: espaço por cima quando as células se empilham. A primeira célula não tem. */
export function StackedCell({ children, gap, className = "" }: { children: ReactNode; gap?: keyof typeof GAP; className?: string }) {
  return <td className={`block align-top md:table-cell md:px-3 md:py-3 ${gap ? GAP[gap] : ""} ${className}`}>{children}</td>;
}
