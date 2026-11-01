import type { Metadata } from "next";
import Link from "next/link";
import { reportContent, submitProposal, toggleSupport } from "@/app/actions";
import { KindLabel, PageHead } from "@/components/labels";
import { currentUser } from "@/lib/auth";
import { CATEGORIES } from "@/lib/categories";
import { db } from "@/lib/db";
import { getProposalThreshold } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Temas emergentes", description: "Proponha e apoie temas municipais para abertura na Voz de Torres Vedras." };

const ERRORS: Record<string, string> = {
  dados: "Verifique o título (10 a 140 caracteres) e a descrição (30 a 1500 caracteres).",
  limite: "Atingiu o limite de ações por agora. Tente mais tarde.",
};

export default async function EmergentesPage({ searchParams }: { searchParams: Promise<{ erro?: string; enviada?: string; denuncia?: string }> }) {
  const { erro, enviada, denuncia } = await searchParams;
  const [user, threshold, proposals] = await Promise.all([
    currentUser(),
    getProposalThreshold(),
    db.topicProposal.findMany({
      where: { status: { in: ["A_RECOLHER_APOIOS", "EM_REVISAO"] } },
      include: { _count: { select: { supports: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const mine = user ? await db.proposalSupport.findMany({ where: { userId: user.id }, select: { proposalId: true } }) : [];
  const supported = new Set(mine.map((row) => row.proposalId));

  return (
    <>
      <PageHead title="Temas emergentes" kicker={<KindLabel kind="RESIDENTES" />}>
        <p>Propostas de residentes. Antes de aparecerem aqui, passam por uma revisão de linguagem. Com {threshold} apoios, seguem para análise da moderação.</p>
      </PageHead>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_22rem]">
        <div>
          {erro && ERRORS[erro] ? <p role="alert" className="mb-3 font-medium">{ERRORS[erro]}</p> : null}
          {denuncia ? <p role="status" className="mb-3 font-medium text-record">Obrigado. A moderação vai analisar.</p> : null}
          <ul className="space-y-3">
            {proposals.map((proposal) => {
              const count = proposal._count.supports;
              return (
                <li key={proposal.id} className="rounded-lg border border-line bg-surface p-5">
                  <p className="text-xs font-semibold text-muted">{proposal.category}</p>
                  <h2 className="mt-1 font-serif text-lg font-semibold">{proposal.title}</h2>
                  <p className="mt-1 text-sm">{proposal.description}</p>
                  <p className="mt-2 text-sm text-muted">
                    {proposal.status === "EM_REVISAO" ? "Em análise pela moderação" : `${count} de ${threshold} apoios`}
                  </p>
                  {proposal.status === "A_RECOLHER_APOIOS" ? (
                    <div className="mt-1 h-1.5 rounded-sm bg-line/50" aria-hidden="true">
                      <div className="h-1.5 rounded-sm bg-opinion" style={{ width: `${Math.min(100, (count / threshold) * 100)}%` }} />
                    </div>
                  ) : null}
                  {user && proposal.status === "A_RECOLHER_APOIOS" ? (
                    <div className="mt-3 flex flex-wrap items-start gap-2">
                      <form action={toggleSupport}>
                        <input type="hidden" name="proposalId" value={proposal.id} />
                        <button type="submit" className={supported.has(proposal.id) ? "btn-quiet" : "btn"}>
                          {supported.has(proposal.id) ? "Retirar apoio" : "Apoiar"}
                        </button>
                      </form>
                      <details className="text-sm">
                        <summary className="flex min-h-11 cursor-pointer items-center underline">Denunciar conteúdo</summary>
                        <form action={reportContent} className="mt-1 space-y-2">
                          <input type="hidden" name="targetId" value={proposal.id} />
                          <label className="block">Motivo<input name="reason" className="field mt-1" maxLength={500} required /></label>
                          <button type="submit" className="btn-quiet">Enviar denúncia</button>
                        </form>
                      </details>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {proposals.length === 0 ? <p className="text-muted">Ainda não há propostas a recolher apoios.</p> : null}
        </div>

        <aside className="rounded-lg border border-line bg-surface p-5 lg:self-start">
          <h2 className="font-serif text-lg font-semibold">Propor um tema</h2>
          {enviada ? <p role="status" className="mt-2 text-sm font-medium text-record">Proposta recebida. Aparece aqui depois da revisão.</p> : null}
          {user ? (
            <form action={submitProposal} className="mt-3 space-y-3 text-sm">
              <label className="block font-medium">Título<input name="title" className="field mt-1" minLength={10} maxLength={140} required /></label>
              <label className="block font-medium">Categoria
                <select name="category" className="field mt-1" required>
                  {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label className="block font-medium">Descrição
                <textarea name="description" rows={5} className="field mt-1" minLength={30} maxLength={1500} required />
              </label>
              <p className="text-xs text-muted">Descreva o assunto, não pessoas. Evite dados pessoais e acusações.</p>
              <button type="submit" className="btn w-full">Enviar proposta</button>
            </form>
          ) : (
            <p className="mt-2 text-sm"><Link href="/entrar?seguinte=/temas/emergentes" className="underline">Entre com o seu email</Link> para propor ou apoiar temas.</p>
          )}
        </aside>
      </div>
    </>
  );
}
