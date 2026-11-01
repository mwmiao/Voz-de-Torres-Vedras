import type { Metadata } from "next";
import Link from "next/link";
import { deleteAccount, logout, removePosition } from "@/app/actions";
import { PageHead } from "@/components/labels";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "A minha conta", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ContaPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const user = await requireUser();
  const positions = await db.position.findMany({
    where: { userId: user.id },
    include: { issue: { select: { id: true, slug: true, title: true } }, option: { select: { label: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <>
      <PageHead title="A minha conta"><p>Esta página só é visível para si.</p></PageHead>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
        {user.role !== "USER" ? <Link href="/moderacao" className="btn no-underline">Área de moderação</Link> : null}
        <section>
          <h2 className="font-serif text-xl font-semibold">As minhas posições</h2>
          {positions.length === 0 ? <p className="mt-1 text-muted">Ainda não registou posições.</p> : null}
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line bg-surface">
            {positions.map((position) => (
              <li key={position.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <Link href={`/temas/${position.issue.slug}`} className="font-medium underline">{position.issue.title}</Link>
                  <p className="text-sm text-muted">{position.option.label} · {formatDate(position.updatedAt)}</p>
                </div>
                <form action={removePosition}>
                  <input type="hidden" name="issueId" value={position.issue.id} />
                  <input type="hidden" name="seguinte" value="/conta" />
                  <button type="submit" className="btn-quiet">Remover</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="font-serif text-xl font-semibold">Os meus dados</h2>
          <p className="mt-1 text-sm text-muted">Conta criada em {formatDate(user.createdAt)}.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a href="/conta/exportar" className="btn-quiet no-underline">Descarregar os meus dados</a>
            <form action={logout}><button type="submit" className="btn-quiet">Sair</button></form>
          </div>
        </section>
        <section>
          <h2 className="font-serif text-xl font-semibold">Apagar conta</h2>
          <p className="mt-1 text-sm">Apaga a conta, as posições e os apoios. Não pode ser desfeito.</p>
          {erro === "confirmar" ? <p role="alert" className="mt-1 text-sm font-medium">Escreva APAGAR para confirmar.</p> : null}
          <form action={deleteAccount} className="mt-2 flex flex-wrap items-end gap-2">
            <label className="text-sm font-medium">Escreva APAGAR<input name="confirmar" className="field mt-1" autoComplete="off" required /></label>
            <button type="submit" className="btn-quiet">Apagar a minha conta</button>
          </form>
        </section>
      </div>
    </>
  );
}
