import type { Metadata } from "next";
import Link from "next/link";
import { KindLabel, LastUpdated, PageHead } from "@/components/labels";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dossiês", description: "Assuntos municipais de Torres Vedras, com contexto neutro, datas e decisões relacionadas." };

export default async function DossiesPage() {
  const issues = await db.issue.findMany({
    include: { _count: { select: { decisions: true, sources: true } } },
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });
  return (
    <>
      <PageHead title="Dossiês" kicker={<KindLabel kind="CONTEXTO_EDITORIAL" />}>
        <p>Assuntos municipais reunidos num só lugar, com um resumo neutro, datas e as decisões oficiais relacionadas.</p>
      </PageHead>
      <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-8 md:grid-cols-2">
        {issues.map((issue) => (
          <li key={issue.id} className="rounded-lg border border-line bg-surface p-5">
            <p className="text-xs font-semibold text-muted">{issue.category}</p>
            <h2 className="mt-1 font-serif text-lg font-semibold"><Link href={`/dossies/${issue.slug}`} className="underline">{issue.title}</Link></h2>
            <p className="mt-1 text-sm text-muted">Fase: {issue.stage}</p>
            <p className="mt-1 text-sm text-muted">{issue._count.decisions} decisões · {issue._count.sources} fontes</p>
            <LastUpdated date={issue.updatedAt} className="mt-2" />
          </li>
        ))}
      </ul>
    </>
  );
}
