import type { Source } from "@prisma/client";
import { LastUpdated } from "./labels";
import { OfficialBadge, SourceChips } from "./Receipts";

/** Um valor oficial com a sua nota, fonte e data de atualização. Vai dentro de um `<dl>`. */
export function BudgetFigure({ label, value, note, sources, updatedAt }: { label: string; value: string; note: string | null; sources: Source[]; updatedAt: Date }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-serif text-2xl font-semibold tabular-nums">{value}</dd>
      {note ? <dd className="mt-1 text-xs text-muted">{note}</dd> : null}
      <dd className="mt-2 flex flex-wrap items-center gap-2"><OfficialBadge /><SourceChips sources={sources} /></dd>
      <dd><LastUpdated date={updatedAt} className="mt-2" /></dd>
    </div>
  );
}
