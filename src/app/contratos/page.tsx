import type { Metadata } from "next";
import Link from "next/link";
import { Bars } from "@/components/Bars";
import { CsvLink, KindLabel, LastUpdated, PageHead } from "@/components/labels";
import { Receipt, SourceChips } from "@/components/Receipts";
import { db } from "@/lib/db";
import { contractOrder, contractWhere, queryString, type SearchParams } from "@/lib/filters";
import { formatDateShort, formatEur, formatNumber } from "@/lib/format";

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

  const [contracts, stats, procedures, suppliers, cpvs, allProcedures, tenders] = await Promise.all([
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
  ]);

  const count = stats._count._all;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const filters = { ...params, pagina: undefined };
  const pageLink = (target: number) => `/contratos?${queryString(filters, { pagina: String(target) })}`;

  return (
    <>
      <PageHead title="Contratos" kicker={<KindLabel kind="REGISTO_OFICIAL" />}>
        <p>Contratos do Município e dos SMAS registados no Portal BASE em 2026, a partir dos dados abertos do IMPIC. A presença de um contrato ou fornecedor aqui não implica qualquer juízo sobre ele.</p>
        <LastUpdated date={stats._max.updatedAt} className="mt-1" />
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <form method="get" className="grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <label className="text-sm font-medium">Pesquisar<input name="q" defaultValue={params.q ?? ""} className="field mt-1" placeholder="Objeto ou fornecedor" /></label>
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

        <div className="flex flex-wrap items-end justify-between gap-4">
          <dl className="flex flex-wrap gap-x-10 gap-y-2">
            <div><dt className="text-sm text-muted">Contratos</dt><dd className="font-serif text-2xl font-semibold tabular-nums">{formatNumber(count)}</dd></div>
            <div><dt className="text-sm text-muted">Valor contratual somado</dt><dd className="font-serif text-2xl font-semibold tabular-nums">{formatEur(stats._sum.priceEur ?? 0)}</dd></div>
          </dl>
          <CsvLink href={`/dados/contratos.csv?${queryString(filters)}`} />
        </div>

        <section aria-labelledby="padroes">
          <h2 id="padroes" className="font-serif text-2xl font-semibold">Padrões a consultar</h2>
          <p className="text-sm text-muted">Somas descritivas para orientar a consulta. Não indicam qualquer irregularidade.</p>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <Bars title="Por tipo de procedimento" rows={procedures.map((row) => ({ label: row.procedureType, value: Number(row._sum.priceEur ?? 0), detail: `${row._count._all} contratos` }))} />
            <Bars title="Por categoria CPV" rows={cpvs.map((row) => ({ label: row.cpvLabel ?? "Sem categoria", value: Number(row._sum.priceEur ?? 0) }))} />
            <Bars title="Por fornecedor" rows={suppliers.map((row) => ({ label: row.supplierName, value: Number(row._sum.priceEur ?? 0), detail: `${row._count._all} contratos` }))} />
          </div>
        </section>

        <section aria-labelledby="lista">
          <h2 id="lista" className="font-serif text-2xl font-semibold">Lista de contratos</h2>
          <div className="relative mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="w-full min-w-[46rem] text-left text-sm">
              <caption className="sr-only">Contratos públicos</caption>
              <thead className="bg-paper text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Data</th>
                  <th scope="col" className="px-3 py-2">Objeto</th>
                  <th scope="col" className="px-3 py-2">Fornecedor</th>
                  <th scope="col" className="px-3 py-2">Adjudicante</th>
                  <th scope="col" className="px-3 py-2 text-right">Valor</th>
                  <th scope="col" className="px-3 py-2">Fonte</th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((contract) => (
                  <tr key={contract.id} className="border-t border-line align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{contract.signedAt ? formatDateShort(contract.signedAt) : "—"}</td>
                    <td className="px-3 py-2">
                      {contract.title}
                      <span className="block text-xs text-muted">{contract.procedureType}</span>
                      {contract.modifications.map((modification) => (
                        <span key={modification.id} className="block text-xs text-muted">
                          Modificação{modification.date ? ` de ${formatDateShort(modification.date)}` : ""}
                          {modification.newPriceEur ? `: novo valor ${formatEur(modification.newPriceEur)}` : ""}
                        </span>
                      ))}
                      <LastUpdated date={contract.updatedAt} />
                    </td>
                    <td className="px-3 py-2">{contract.supplierName}</td>
                    <td className="px-3 py-2">{contract.awardingBody}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatEur(contract.priceEur)}</td>
                    <td className="px-3 py-2"><SourceChips sources={contract.sources} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav aria-label="Páginas" className="mt-3 flex items-center justify-between text-sm">
            {page > 1 ? <Link href={pageLink(page - 1)} className="underline">Anterior</Link> : <span />}
            <span className="text-muted">Página {page} de {pages}</span>
            {page < pages ? <Link href={pageLink(page + 1)} className="underline">Seguinte</Link> : <span />}
          </nav>
        </section>

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
