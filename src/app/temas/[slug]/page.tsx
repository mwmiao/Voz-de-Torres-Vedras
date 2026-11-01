import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { removePosition, setPosition } from "@/app/actions";
import { AggregateResults } from "@/components/AggregateResults";
import { DecisionList } from "@/components/DecisionTable";
import { ExampleBadge, KindLabel, PageHead } from "@/components/labels";
import { Claims, Receipt } from "@/components/Receipts";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getAggregates, SOURCED_DECISION } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ registada?: string; erro?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const issue = await db.issue.findUnique({ where: { slug: (await params).slug }, select: { title: true, summary: true } });
  return issue ? { title: issue.title, description: issue.summary } : {};
}

export default async function IssuePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { registada, erro } = await searchParams;
  const issue = await db.issue.findFirst({
    where: { slug, status: { in: ["ATIVO", "ENCERRADO"] } },
    include: {
      options: { orderBy: { order: "asc" } },
      dates: { orderBy: { date: "asc" } },
      sources: { orderBy: { publishedAt: "desc" } },
      claims: { include: { sources: true } },
      decisions: {
        where: SOURCED_DECISION,
        include: { meeting: true, sources: { where: { official: true } } },
        orderBy: { meeting: { date: "desc" } },
      },
    },
  });
  if (!issue) notFound();

  const [user, aggregates] = await Promise.all([currentUser(), getAggregates([issue.id])]);
  const mine = user
    ? await db.position.findUnique({ where: { userId_issueId: { userId: user.id, issueId: issue.id } } })
    : null;

  return (
    <>
      <PageHead title={issue.title} kicker={<div className="flex flex-wrap items-center gap-2"><Link href="/temas" className="text-sm underline">Temas</Link><span className="text-sm text-muted">· {issue.category}</span>{issue.isExample ? <ExampleBadge /> : null}</div>} />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_21rem]">
        <div className="min-w-0 space-y-8">
          <section aria-labelledby="resumo">
            <KindLabel kind="CONTEXTO_EDITORIAL" />
            <h2 id="resumo" className="mt-2 font-serif text-xl font-semibold">Resumo</h2>
            <p className="mt-2">{issue.summary}</p>
            <p className="mt-2 text-sm text-muted">Fase atual: {issue.stage}</p>
            {issue.claims.length > 0 ? <div className="mt-4"><Claims claims={issue.claims} /></div> : null}
          </section>

          {issue.dates.length > 0 ? (
            <section aria-labelledby="datas">
              <h2 id="datas" className="font-serif text-xl font-semibold">Datas-chave</h2>
              <ol className="mt-2 space-y-1.5 border-l-2 border-line pl-4">
                {issue.dates.map((date) => (
                  <li key={date.id}><span className="font-medium">{formatDate(date.date)}:</span> {date.label}</li>
                ))}
              </ol>
            </section>
          ) : null}

          <section aria-labelledby="votacoes">
            <KindLabel kind="REGISTO_OFICIAL" />
            <h2 id="votacoes" className="mt-2 font-serif text-xl font-semibold">Decisões e votações relacionadas</h2>
            <div className="mt-3">
              {issue.decisions.length > 0 ? <DecisionList decisions={issue.decisions} /> : <p className="text-sm text-muted">Sem decisões oficiais associadas.</p>}
            </div>
          </section>

          {issue.sources.length > 0 ? (
            <section aria-labelledby="documentos">
              <h2 id="documentos" className="font-serif text-xl font-semibold">Documentos municipais</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {issue.sources.map((source) => <Receipt key={source.id} source={source} />)}
              </div>
            </section>
          ) : null}
        </div>

        <aside id="posicao" className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <section aria-labelledby="resultados" className="rounded-lg border border-line bg-surface p-5">
            <KindLabel kind="RESIDENTES" />
            <h2 id="resultados" className="mt-2 font-serif text-lg font-semibold">Posições de residentes</h2>
            <p className="mb-3 text-xs text-muted">Opinião agregada. Não é uma sondagem representativa nem um registo oficial.</p>
            <AggregateResults aggregate={aggregates.get(issue.id)!} />
          </section>

          <section aria-labelledby="minha" className="rounded-lg border border-line bg-surface p-5">
            <h2 id="minha" className="font-serif text-lg font-semibold">A sua posição</h2>
            {registada ? <p role="status" className="mt-2 text-sm font-medium text-record">Posição registada. Só você a pode ver.</p> : null}
            {erro === "limite" ? <p role="alert" className="mt-2 text-sm font-medium">Demasiadas alterações. Tente novamente mais tarde.</p> : null}
            {issue.isExample ? (
              <p className="mt-2 text-sm text-muted">Este tema é um exemplo: não recebe posições.</p>
            ) : issue.status !== "ATIVO" ? (
              <p className="mt-2 text-sm text-muted">Este tema está encerrado.</p>
            ) : !user ? (
              <p className="mt-2 text-sm">
                <Link href={`/entrar?seguinte=${encodeURIComponent(`/temas/${issue.slug}`)}`} className="underline">Entre com o seu email</Link> para registar a sua posição.
              </p>
            ) : (
              <>
                <form action={setPosition} className="mt-3 space-y-2">
                  <input type="hidden" name="issueId" value={issue.id} />
                  <fieldset className="space-y-1">
                    <legend className="sr-only">Escolha a sua posição</legend>
                    {issue.options.map((option) => (
                      <label key={option.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded border border-line px-3 py-2 text-sm hover:bg-paper">
                        <input type="radio" name="optionId" value={option.id} defaultChecked={mine?.optionId === option.id} required />
                        {option.label}
                      </label>
                    ))}
                  </fieldset>
                  <button type="submit" className="btn w-full">{mine ? "Atualizar posição" : "Registar posição"}</button>
                </form>
                {mine ? (
                  <form action={removePosition} className="mt-2">
                    <input type="hidden" name="issueId" value={issue.id} />
                    <input type="hidden" name="seguinte" value={`/temas/${issue.slug}`} />
                    <button type="submit" className="btn-quiet w-full">Remover a minha posição</button>
                  </form>
                ) : null}
              </>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
