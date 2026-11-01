import type { Metadata } from "next";
import Link from "next/link";
import { AggregateResults } from "@/components/AggregateResults";
import { ExampleBadge, KindLabel, PageHead } from "@/components/labels";
import { CATEGORIES } from "@/lib/categories";
import { db } from "@/lib/db";
import { getAggregates } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Temas", description: "Temas municipais de Torres Vedras com posições agregadas de residentes." };

export default async function TemasPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { categoria } = await searchParams;
  const issues = await db.issue.findMany({
    where: { status: "ATIVO", category: categoria || undefined },
    orderBy: [{ isExample: "asc" }, { updatedAt: "desc" }],
  });
  const aggregates = await getAggregates(issues.map((issue) => issue.id));

  return (
    <>
      <PageHead title="Temas" kicker={<KindLabel kind="RESIDENTES" />}>
        <p>Temas municipais em curso, com resumo neutro, decisões relacionadas e posições agregadas de residentes.</p>
      </PageHead>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <nav aria-label="Filtrar por categoria" className="flex flex-wrap gap-2 text-sm">
          <Link href="/temas" aria-current={!categoria ? "page" : undefined} className={`rounded border px-2.5 py-1 ${!categoria ? "border-record bg-record text-white" : "border-line bg-surface"}`}>Todos</Link>
          {CATEGORIES.map((category) => (
            <Link
              key={category}
              href={`/temas?categoria=${encodeURIComponent(category)}`}
              aria-current={categoria === category ? "page" : undefined}
              className={`rounded border px-2.5 py-1 ${categoria === category ? "border-record bg-record text-white" : "border-line bg-surface"}`}
            >
              {category}
            </Link>
          ))}
        </nav>

        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {issues.map((issue) => (
            <li key={issue.id} className="rounded-lg border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted">{issue.category}</span>
                {issue.isExample ? <ExampleBadge /> : null}
              </div>
              <h2 className="mt-1 font-serif text-lg font-semibold">
                <Link href={`/temas/${issue.slug}`} className="underline">{issue.title}</Link>
              </h2>
              <p className="mt-1 text-sm text-muted">Fase: {issue.stage}</p>
              <div className="mt-3"><AggregateResults aggregate={aggregates.get(issue.id)!} /></div>
            </li>
          ))}
        </ul>
        {issues.length === 0 ? <p className="mt-6 text-muted">Ainda não há temas nesta categoria. Pode propor um em Temas emergentes.</p> : null}

        <aside className="mt-10 rounded-lg border border-line bg-opinion-soft p-5">
          <h2 className="font-serif text-lg font-semibold">Temas emergentes</h2>
          <p className="mt-1 text-sm">Falta um tema? Proponha-o. Ao reunir apoios suficientes, a moderação analisa-o para abertura.</p>
          <Link href="/temas/emergentes" className="btn mt-3 no-underline">Ver temas emergentes</Link>
        </aside>
      </div>
    </>
  );
}
