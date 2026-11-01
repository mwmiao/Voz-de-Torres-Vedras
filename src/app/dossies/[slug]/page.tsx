import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DecisionList } from "@/components/DecisionTable";
import { KindLabel, LastUpdated, PageHead } from "@/components/labels";
import { Claims, Receipt } from "@/components/Receipts";
import { db } from "@/lib/db";
import { SOURCED_DECISION } from "@/lib/filters";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const issue = await db.issue.findUnique({ where: { slug: (await params).slug }, select: { title: true, summary: true } });
  return issue ? { title: issue.title, description: issue.summary } : {};
}

export default async function DossierPage({ params }: Props) {
  const issue = await db.issue.findUnique({
    where: { slug: (await params).slug },
    include: {
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

  return (
    <>
      <PageHead title={issue.title} kicker={<div className="flex flex-wrap items-center gap-2"><Link href="/dossies" className="text-sm underline">Dossiês</Link><span className="text-sm text-muted">· {issue.category}</span></div>}>
        <LastUpdated date={issue.updatedAt} />
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <section aria-labelledby="resumo" className="max-w-3xl">
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
              {issue.dates.map((date) => <li key={date.id}><span className="font-medium">{formatDate(date.date)}:</span> {date.label}</li>)}
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

        <section aria-labelledby="documentos">
          <h2 id="documentos" className="font-serif text-xl font-semibold">Documentos municipais</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {issue.sources.map((source) => <Receipt key={source.id} source={source} />)}
          </div>
        </section>
      </div>
    </>
  );
}
