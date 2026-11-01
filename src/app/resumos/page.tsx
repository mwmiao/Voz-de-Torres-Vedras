import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Pagination, SummaryBlock } from "@/components/civic";
import { CsvLink, PageHead } from "@/components/labels";
import { db } from "@/lib/db";
import { queryString, type SearchParams } from "@/lib/filters";
import { formatNumber } from "@/lib/format";
import { searchKey } from "@/lib/search";
import { SUMMARY_TYPE_LABEL } from "@/lib/summaries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Resumos simples", description: "Decisões, reuniões, contratos, regulamentos e documentos municipais explicados de forma simples, com a fonte oficial." };

const PAGE_SIZE = 12;

export default async function ResumosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.pagina) || 1);
  const q = searchKey(params.q).trim();
  const entityType = params.tipo && params.tipo in SUMMARY_TYPE_LABEL ? params.tipo : undefined;
  const where: Prisma.SummaryWhereInput = {
    entityType,
    available: params.todos ? undefined : true,
    searchText: q ? { contains: q } : undefined,
  };
  const [summaries, total] = await Promise.all([
    db.summary.findMany({ where, orderBy: [{ date: { sort: "desc", nulls: "last" } }, { title: "asc" }], skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    db.summary.count({ where }),
  ]);
  const filters = { ...params, pagina: undefined };

  return (
    <>
      <PageHead title="Resumos simples">
        <p>Explicações curtas de registos municipais. São geradas por regras a partir de dados oficiais e não substituem os documentos. Em caso de dúvida, prevalece a fonte.</p>
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8">
        <form role="search" method="get" className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-[2fr_1fr_auto]">
          <label className="text-sm font-medium">Pesquisar<input name="q" defaultValue={params.q ?? ""} className="field mt-1" /></label>
          <label className="text-sm font-medium">Tipo
            <select name="tipo" defaultValue={params.tipo ?? ""} className="field mt-1">
              <option value="">Todos</option>
              {Object.entries(SUMMARY_TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <button type="submit" className="btn self-end">Pesquisar</button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm text-muted">{formatNumber(total)} resumos</p>
          <CsvLink href="/dados/resumos.csv" />
        </div>
        <h2 className="sr-only">Resultados</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {summaries.map((summary) => <SummaryBlock key={summary.id} summary={summary} />)}
        </div>
        {summaries.length === 0 ? <EmptyState title="Nenhum resumo corresponde à pesquisa."><Link href="/resumos" className="underline">Limpar pesquisa</Link></EmptyState> : null}
        <Pagination page={page} pages={Math.max(1, Math.ceil(total / PAGE_SIZE))} link={(target) => `/resumos?${queryString(filters, { pagina: String(target) })}`} />
      </div>
    </>
  );
}
