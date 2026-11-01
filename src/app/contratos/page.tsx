import type { Metadata } from "next";
import Link from "next/link";
import { Bars } from "@/components/Bars";
import { Disclosure, EmptyState, MetricCard, Pagination, SectionHead, SummaryBlock } from "@/components/civic";
import { CsvLink, KindLabel, LastUpdated, PageHead } from "@/components/labels";
import { Receipt, SourceChips } from "@/components/Receipts";
import { db } from "@/lib/db";
import { contractOrder, contractWhere, queryString, type SearchParams } from "@/lib/filters";
import { formatDate, formatDateShort, formatEur, formatNumber } from "@/lib/format";
import { summaryMap } from "@/lib/summary-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Contratos", description: "Contratos públicos do Município e dos SMAS de Torres Vedras, com fornecedores, valores e ligação ao Portal BASE." };

const PAGE_SIZE = 20;

const PORTALS = [
  { label: "Portal BASE: contratos do Município", url: "https://www.base.gov.pt/Base/pt/ResultadosPesquisa?type=contratos&query=adjudicanteid%3D579" },
  { label: "Contratação pública no site da Câmara", url: "https://www.cm-tvedras.pt/municipio/camara-municipal/contratacao-publica/" },
  { label: "Conjunto de dados do IMPIC em dados.gov.pt", url: "https://dados.gov.pt/pt/datasets/contratos-publicos-portal-base-impic-contratos-de-2012-a-2026/" },
];

export default async function ContratosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.pagina) || 1);
  const where = contractWhere(params);

  const [contracts, stats, procedures, suppliers, cpvs, allProcedures, tenders, years] = await Promise.all([
    db.contract.findMany({
      where,
      include: { sources: true, modifications: { orderBy: { date: "desc" } } },
      orderBy: contractOrder(params),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.contract.aggregate({ where, _count: { _all: true }, _sum: { priceEur: true }, _max: { updatedAt: true } }),
    db.contract.groupBy({ by: ["procedureType"], where, _sum: { priceEur: true }, _count: { _all: true }, orderBy: { _sum: { priceEur: "desc" } } }),
    db.contract.groupBy({ by: ["supplierName"], where: { ...where, supplierIsPerson: false }, _sum: { priceEur: true }, _count: { _all: true }, orderBy: { _sum: { priceEur: "desc" } }, take: 6 }),
    db.contract.groupBy({ by: ["cpvLabel"], where: { ...where, cpvLabel: { not: null } }, _sum: { priceEur: true }, orderBy: { _sum: { priceEur: "desc" } }, take: 6 }),
    db.contract.findMany({ distinct: ["procedureType"], select: { procedureType: true }, orderBy: { procedureType: "asc" } }),
    db.source.findMany({ where: { type: "CONCURSO", official: true }, orderBy: { publishedAt: { sort: "desc", nulls: "last" } }, take: 8 }),
    db.contract.findMany({ select: { signedAt: true } }),
  ]);

  const count = stats._count._all;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const filters = { ...params, pagina: undefined };
  const filtered = Object.values(filters).some(Boolean);
  const pageLink = (target: number) => `/contratos?${queryString(filters, { pagina: String(target) })}#lista`;
  const summaries = await summaryMap("contrato", contracts.map((contract) => contract.baseId));
  const signed = years.map((row) => row.signedAt?.getUTCFullYear()).filter((year): year is number => Boolean(year));
  const yearOptions = [...new Set(signed)].sort((a, b) => b - a);

  return (
    <>
      <PageHead title="Contratos" kicker={<KindLabel kind="REGISTO_OFICIAL" />}>
        <p>Contratos do Município e dos SMAS registados no Portal BASE. A presença de um contrato ou fornecedor aqui não implica qualquer juízo sobre ele.</p>
        <LastUpdated date={stats._max.updatedAt} className="mt-1" />
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <dl className="grid gap-3 sm:grid-cols-2">
          <MetricCard label={params.ano ? `Contratos em ${params.ano}` : "Contratos"} value={formatNumber(count)} />
          <MetricCard label="Valor contratual somado" value={formatEur(stats._sum.priceEur ?? 0)} />
        </dl>

        <Disclosure summary="Pesquisar e filtrar" open={filtered}>
          <form role="search" method="get" action="#lista" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_auto_1fr_1fr_1fr_auto]">
          <label className="text-sm font-medium">Pesquisar<input name="q" defaultValue={params.q ?? ""} className="field mt-1" placeholder="Objeto ou fornecedor" /></label>
          <label className="text-sm font-medium">Ano
            <select name="ano" defaultValue={params.ano ?? ""} className="field mt-1">
              <option value="">Todos</option>
              {yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Entidade adjudicante
            <select name="entidade" defaultValue={params.entidade ?? ""} className="field mt-1">
              <option value="">Todas</option>
              <option value="502173653">Município de Torres Vedras</option>
              <option value="680015973">SMAS de Torres Vedras</option>
            </select>
          </label>
          <label className="text-sm font-medium">Procedimento
            <select name="procedimento" defaultValue={params.procedimento ?? ""} className="field mt-1">
              <option value="">Todos</option>
              {allProcedures.map(({ procedureType }) => <option key={procedureType}>{procedureType}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium">Ordenar
            <select name="ordem" defaultValue={params.ordem ?? ""} className="field mt-1">
              <option value="">Mais recentes</option>
              <option value="valor">Maior valor</option>
              <option value="fornecedor">Fornecedor</option>
            </select>
          </label>
          <button type="submit" className="btn self-end">Aplicar</button>
        </form>
        </Disclosure>

        <section aria-labelledby="lista">
          <SectionHead id="lista" title={`Lista de contratos (${formatNumber(count)})`} action={<CsvLink href={`/dados/contratos.csv?${queryString(filters)}`} />} />
          {contracts.length > 0 ? (
            <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
              {contracts.map((contract) => {
                const summary = summaries.get(contract.baseId);
                return (
                  <li key={contract.id} className="p-4">
                    <article>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                        <h3 className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere]">{contract.title}</h3>
                        <p className="whitespace-nowrap font-semibold tabular-nums">{formatEur(contract.priceEur)}</p>
                      </div>
                      <dl className="mt-1 grid gap-x-3 text-sm sm:grid-cols-[auto_1fr]">
                        <dt className="text-muted">Fornecedor</dt><dd>{contract.supplierName}</dd>
                        <dt className="text-muted">Adjudicante</dt><dd>{contract.awardingBody}</dd>
                        <dt className="text-muted">Data</dt><dd>{contract.signedAt ? formatDate(contract.signedAt) : "Não indicada na fonte"}</dd>
                        <dt className="text-muted">Procedimento</dt><dd>{contract.procedureType}</dd>
                      </dl>
                      {contract.modifications.map((modification) => (
                        <p key={modification.id} className="mt-1 text-sm text-muted">
                          Modificação{modification.date ? ` de ${formatDateShort(modification.date)}` : ""}
                          {modification.newPriceEur ? `: novo valor ${formatEur(modification.newPriceEur)}` : ""}
                        </p>
                      ))}
                      <div className="mt-2"><SourceChips sources={contract.sources} /></div>
                      {summary ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm underline">Resumo simples</summary>
                          <div className="mt-2"><SummaryBlock summary={summary} heading={false} /></div>
                        </details>
                      ) : null}
                    </article>
                  </li>
                );
              })}
            </ul>
          ) : <div className="mt-3"><EmptyState title="Nenhum contrato corresponde aos filtros."><Link href="/contratos" className="underline">Limpar filtros</Link></EmptyState></div>}
          <Pagination page={page} pages={pages} link={pageLink} />
        </section>

        <Disclosure summary="Contratos por procedimento, categoria e fornecedor">
          <p className="text-sm text-muted">Somas descritivas para orientar a consulta. Não indicam qualquer irregularidade.</p>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <Bars title="Por tipo de procedimento" rows={procedures.map((row) => ({ label: row.procedureType, value: Number(row._sum.priceEur ?? 0), detail: `${row._count._all} contratos` }))} />
            <Bars title="Por categoria CPV" rows={cpvs.map((row) => ({ label: row.cpvLabel ?? "Sem categoria", value: Number(row._sum.priceEur ?? 0) }))} />
            <Bars title="Por fornecedor" rows={suppliers.map((row) => ({ label: row.supplierName, value: Number(row._sum.priceEur ?? 0), detail: `${row._count._all} contratos` }))} />
          </div>
        </Disclosure>

        <section aria-labelledby="procedimentos">
          <h2 id="procedimentos" className="font-serif text-2xl font-semibold">Procedimentos recentes</h2>
          <p className="text-sm text-muted">Concursos e anúncios publicados. <Link href="/fontes?tipo=CONCURSO" className="underline">Ver todos</Link></p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {tenders.map((tender) => <Receipt key={tender.id} source={tender} />)}
          </div>
        </section>

        <section aria-labelledby="portais">
          <h2 id="portais" className="font-serif text-2xl font-semibold">Portais oficiais</h2>
          <ul className="mt-2 space-y-1">
            {PORTALS.map((portal) => <li key={portal.url}><a href={portal.url} target="_blank" rel="noopener noreferrer" className="underline">{portal.label}</a></li>)}
          </ul>
        </section>
      </div>
    </>
  );
}
