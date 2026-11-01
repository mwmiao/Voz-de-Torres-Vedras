import type { Aggregate } from "@/lib/aggregate";
import { formatNumber } from "@/lib/format";

export function AggregateResults({ aggregate }: { aggregate: Aggregate }) {
  if (!aggregate.visible) {
    return (
      <p className="text-sm text-muted">
        Ainda há menos de {aggregate.minimum} posições. Os resultados só são publicados a partir deste número, para proteger quem respondeu.
      </p>
    );
  }
  return (
    <div>
      <ul className="space-y-2">
        {aggregate.rows.map((row) => (
          <li key={row.id}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{row.label}</span>
              <span className="font-semibold tabular-nums">{row.percent}%</span>
            </div>
            <div className="mt-1 h-2 rounded-sm bg-line/50" aria-hidden="true" title={`${row.label}: ${row.percent}%`}>
              <div className="h-2 rounded-sm bg-opinion" style={{ width: `${row.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">{formatNumber(aggregate.total)} posições registadas · apenas resultados agregados</p>
    </div>
  );
}
