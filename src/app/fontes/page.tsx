import type { SourceType } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { KindLabel, LastUpdated, PageHead } from "@/components/labels";
import { Receipt } from "@/components/Receipts";
import { db } from "@/lib/db";
import { queryString } from "@/lib/filters";
import { searchKey } from "@/lib/search";
import { formatNumber } from "@/lib/format";
import { SOURCE_TYPE_LABEL } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fontes", description: "Recibos: documentos oficiais que sustentam cada registo e afirmação." };

const PAGE_SIZE = 30;

export default async function FontesPage({ searchParams }: { searchParams: Promise<{ tipo?: string; pagina?: string; q?: string }> }) {
  const params = await searchParams;
  const type = params.tipo && params.tipo in SOURCE_TYPE_LABEL ? (params.tipo as SourceType) : undefined;
  const page = Math.max(1, Number(params.pagina) || 1);
  const q = params.q?.trim() ?? "";
  const key = searchKey(q);
  const where = { type, searchText: key ? { contains: key } : undefined };
  const [sources, total, groups, updated] = await Promise.all([
    db.source.findMany({
      where,
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { title: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.source.count({ where }),
    db.source.groupBy({ by: ["type"], _count: { _all: true } }),
    db.source.aggregate({ _max: { retrievedAt: true } }),
  ]);
  const pageLink = (target: number) => `/fontes?${queryString({ tipo: type, q, pagina: String(target) })}`;

  return (
    <>
      <PageHead title="Fontes" kicker={<KindLabel kind="REGISTO_OFICIAL" />}>
        <p>Cada fonte indica a entidade, o tipo de documento e as datas de publicação e de consulta. Em caso de divergência, prevalece sempre o documento oficial.</p>
        <LastUpdated date={updated._max.retrievedAt} className="mt-1" />
      </PageHead>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <form role="search" method="get" className="mb-4 flex max-w-xl items-end gap-2">
          {type ? <input type="hidden" name="tipo" value={type} /> : null}
          <label className="flex-1 text-sm font-medium">Pesquisar fontes<input name="q" defaultValue={q} className="field mt-1" /></label>
          <button type="submit" className="btn">Pesquisar</button>
        </form>
        <nav aria-label="Filtrar por tipo" className="flex flex-wrap gap-2 text-sm">
          <Link href="/fontes" className={`rounded border px-2.5 py-1 ${!type ? "border-record bg-record text-white" : "border-line bg-surface"}`}>Todas</Link>
          {groups.map((group) => (
            <Link key={group.type} href={`/fontes?tipo=${group.type}`} className={`rounded border px-2.5 py-1 ${type === group.type ? "border-record bg-record text-white" : "border-line bg-surface"}`}>
              {SOURCE_TYPE_LABEL[group.type]} ({formatNumber(group._count._all)})
            </Link>
          ))}
        </nav>
        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => <Receipt key={source.id} source={source} />)}
        </div>
        <nav aria-label="Páginas" className="mt-5 flex justify-between text-sm">
          {page > 1 ? <Link className="underline" href={pageLink(page - 1)}>Anterior</Link> : <span />}
          {page * PAGE_SIZE < total ? <Link className="underline" href={pageLink(page + 1)}>Seguinte</Link> : <span />}
        </nav>
      </div>
    </>
  );
}
