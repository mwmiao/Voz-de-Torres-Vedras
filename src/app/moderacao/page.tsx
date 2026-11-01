import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export default async function ModeracaoPage() {
  const [submitted, review, reports, claims, drafts, events] = await Promise.all([
    db.topicProposal.count({ where: { status: "SUBMETIDA" } }),
    db.topicProposal.count({ where: { status: "EM_REVISAO" } }),
    db.report.count({ where: { status: "ABERTA" } }),
    db.claim.count({ where: { sources: { none: { official: true } } } }),
    db.issue.count({ where: { status: "RASCUNHO" } }),
    db.moderationEvent.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
  ]);
  const tiles = [
    ["Propostas por rever", submitted],
    ["Atingiram o limiar", review],
    ["Denúncias abertas", reports],
    ["Afirmações não verificadas", claims],
    ["Temas em rascunho", drafts],
  ] as const;

  return (
    <>
      <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-surface p-4">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="font-serif text-3xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <h2 className="mt-8 font-serif text-xl font-semibold">Registo de moderação</h2>
      <p className="text-sm text-muted">Inclui sinais automáticos de abuso, que são indícios para revisão e não conclusões.</p>
      <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface text-sm">
        {events.map((event) => (
          <li key={event.id} className="p-3">
            <span className="font-medium">{event.action}</span> · {event.targetType} · {formatDate(event.createdAt)}
            {event.note ? <span className="block text-muted">{event.note}</span> : null}
          </li>
        ))}
        {events.length === 0 ? <li className="p-3 text-muted">Sem eventos.</li> : null}
      </ul>
    </>
  );
}
