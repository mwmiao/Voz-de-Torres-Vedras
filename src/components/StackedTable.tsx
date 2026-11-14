import type { ReactNode } from "react";

// Classes escritas por extenso para o Tailwind as encontrar.
const GAP = { 1: "mt-1 md:mt-0", 2: "mt-2 md:mt-0" } as const;

export type StackedColumn<T> = {
  label: string;
  /** Alinha à direita em ecrãs largos, no cabeçalho e nas células. */
  right?: boolean;
  /** Espaço por cima quando as células se empilham. A primeira coluna não tem. */
  gap?: keyof typeof GAP;
  /** Classes da célula, como a largura em ecrãs largos. */
  className?: string;
  cell: (row: T) => ReactNode;
};

/**
 * Lista de registos que, em ecrãs pequenos, mostra cada registo como um bloco
 * e, em ecrãs largos, como uma linha de tabela com cabeçalhos.
 * Cada coluna define o cabeçalho e a célula no mesmo sítio.
 */
export function StackedTable<T>({ caption, rows, rowKey, columns }: { caption: string; rows: T[]; rowKey: (row: T) => string; columns: StackedColumn<T>[] }) {
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
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="block border-t border-line p-3 first:border-t-0 md:table-row md:p-0">
              {columns.map((column) => (
                <td key={column.label} className={["block align-top md:table-cell md:px-3 md:py-3", column.gap && GAP[column.gap], column.right && "md:text-right", column.className].filter(Boolean).join(" ")}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
