import { db } from "@/lib/db";
import { resolveReport, reviewClaim } from "../actions";

export default async function DenunciasPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const [reports, claims] = await Promise.all([
    db.report.findMany({ where: { status: "ABERTA" }, orderBy: { createdAt: "asc" } }),
    db.claim.findMany({ where: { sources: { none: { official: true } } }, include: { issue: { select: { title: true } } } }),
  ]);
  const proposals = await db.topicProposal.findMany({ where: { id: { in: reports.map((report) => report.targetId) } } });
  const titles = new Map(proposals.map((proposal) => [proposal.id, proposal.title]));

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <h2 className="font-serif text-xl font-semibold">Denúncias abertas</h2>
        <ul className="mt-3 space-y-3">
          {reports.map((report) => (
            <li key={report.id} className="rounded-lg border border-line bg-surface p-4 text-sm">
              <p className="font-medium">{titles.get(report.targetId) ?? report.targetId}</p>
              <p>{report.reason}</p>
              <form action={resolveReport} className="mt-2 flex gap-2">
                <input type="hidden" name="id" value={report.id} />
                <button name="decision" value="resolver" className="btn">Retirar conteúdo</button>
                <button name="decision" value="rejeitar" className="btn-quiet">Manter</button>
              </form>
            </li>
          ))}
          {reports.length === 0 ? <li className="text-muted">Sem denúncias abertas.</li> : null}
        </ul>
      </section>
      <section>
        <h2 className="font-serif text-xl font-semibold">Afirmações não verificadas</h2>
        <p className="text-sm text-muted">Ligue uma fonte oficial ou remova a afirmação.</p>
        {erro === "fonte" ? <p role="alert" className="mt-1 text-sm font-medium">A fonte tem de ter título e um domínio oficial.</p> : null}
        <ul className="mt-3 space-y-3">
          {claims.map((claim) => (
            <li key={claim.id} className="rounded-lg border border-line bg-surface p-4 text-sm">
              <p className="text-xs text-muted">{claim.issue?.title}</p>
              <p className="font-medium">{claim.text}</p>
              <form action={reviewClaim} className="mt-2 space-y-2">
                <input type="hidden" name="id" value={claim.id} />
                <label className="block">URL oficial<input name="sourceUrl" type="url" className="field mt-1" /></label>
                <label className="block">Título do documento<input name="sourceTitle" className="field mt-1" /></label>
                <div className="flex gap-2">
                  <button name="decision" value="verificar" className="btn">Ligar fonte</button>
                  <button name="decision" value="remover" className="btn-quiet">Remover</button>
                </div>
              </form>
            </li>
          ))}
          {claims.length === 0 ? <li className="text-muted">Sem afirmações por verificar.</li> : null}
        </ul>
      </section>
    </div>
  );
}
