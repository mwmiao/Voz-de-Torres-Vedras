import { formatEur } from "@/lib/format";

type Row = { label: string; value: number; detail?: string };

/** Barras horizontais de uma só série: o rótulo e o valor estão sempre em texto, numa tabela real. */
export function Bars({ title, rows, format = formatEur, unit = "Valor" }: { title: string; rows: Row[]; format?: (value: number) => string; unit?: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <figure className="min-w-0 rounded-lg border border-line bg-surface p-4">
      <figcaption className="font-semibold">{title}</figcaption>
      <table className="mt-3 block w-full text-sm [overflow-wrap:anywhere]">
        <thead className="sr-only">
          <tr><th scope="col">Categoria</th><th scope="col">{unit}</th></tr>
        </thead>
        <tbody className="block">
          {rows.map((row) => (
            <tr key={row.label} className="block py-1.5">
              <th scope="row" className="block text-left font-normal">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">{row.label}</span>
                  <span className="whitespace-nowrap font-semibold tabular-nums">{format(row.value)}</span>
                </span>
                {row.detail ? <span className="block text-xs text-muted">{row.detail}</span> : null}
              </th>
              <td className="mt-1 block" aria-hidden="true">
                <div className="h-2 rounded-r-sm bg-record" style={{ width: `${Math.max(1, (row.value / max) * 100)}%` }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
