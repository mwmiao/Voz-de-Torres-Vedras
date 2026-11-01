import { db } from "@/lib/db";
import { getProposalThreshold } from "@/lib/queries";
import { reviewProposal } from "../actions";

export default async function PropostasPage() {
  const [proposals, threshold] = await Promise.all([
    db.topicProposal.findMany({
      where: { status: { in: ["SUBMETIDA", "EM_REVISAO", "A_RECOLHER_APOIOS"] } },
      include: { _count: { select: { supports: true } } },
      orderBy: { createdAt: "asc" },
    }),
    getProposalThreshold(),
  ]);

  return (
    <>
      <h2 className="font-serif text-xl font-semibold">Propostas</h2>
      <p className="text-sm text-muted">Reveja linguagem e duplicados antes de publicar. Limiar para análise: {threshold} apoios. A identidade de quem propõe não é mostrada.</p>
      <ul className="mt-3 space-y-3">
        {proposals.map((proposal) => (
          <li key={proposal.id} className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs font-semibold text-muted">{proposal.status} · {proposal.category} · {proposal._count.supports} apoios</p>
            <h3 className="font-medium">{proposal.title}</h3>
            <p className="text-sm">{proposal.description}</p>
            <form action={reviewProposal} className="mt-3 flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={proposal.id} />
              <label className="min-w-60 flex-1 text-sm font-medium">Nota interna<input name="note" className="field mt-1" /></label>
              {proposal.status === "SUBMETIDA" ? <button name="decision" value="aprovar" className="btn">Publicar para apoios</button> : null}
              {proposal.status !== "SUBMETIDA" ? <button name="decision" value="promover" className="btn">Promover a tema</button> : null}
              <button name="decision" value="duplicada" className="btn-quiet">Duplicada</button>
              <button name="decision" value="recusar" className="btn-quiet">Recusar</button>
            </form>
          </li>
        ))}
        {proposals.length === 0 ? <li className="text-muted">Nada por rever.</li> : null}
      </ul>
    </>
  );
}
