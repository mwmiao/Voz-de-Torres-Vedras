import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { Bars } from "@/components/Bars";
import { ExampleBadge, KindLabel, PageHead } from "@/components/labels";
import { OfficialBadge, SourceChips } from "@/components/Receipts";
import { db } from "@/lib/db";
import { formatDate, formatDateShort, formatEur, formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dados públicos", description: "Situação financeira, contratos públicos e documentos orçamentais de Torres Vedras, com ligação às fontes oficiais." };

const PAGE_SIZE = 20;

const PORTALS = [
  { label: "Portal BASE: contratos do Município", url: "https://www.base.gov.pt/Base/pt/ResultadosPesquisa?type=contratos&query=adjudicanteid%3D579" },
  { label: "Portal da Transparência", url: "https://transparencia.gov.pt/" },
  { label: "Diário da República", url: "https://diariodarepublica.pt/" },
  { label: "Publicações da Câmara Municipal", url: "https://www.cm-tvedras.pt/documentos/gestao/" },
  { label: "Transparência no site da Câmara", url: "https://www.cm-tvedras.pt/transparencia" },
];

type Search = { q?: string; entidade?: string; procedimento?: string; ordem?: string; pagina?: string };

export default async function TransparenciaPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.pagina) || 1);
  const where: Prisma.ContractWhereInput = {
    awardingNif: params.entidade || undefined,
    procedureType: params.procedimento || undefined,
    OR: q
      ? [{ title: { contains: q, mode: "insensitive" } }, { supplierName: { contains: q, mode: "insensitive" } }]
      : undefined,
  };

  const [facts, budget, contracts, count, sum, procedures, suppliers, cpvs, docs] = await Promise.all([
    db.budgetEntry.findMany({ where: { kind: "SITUACAO_FINANCEIRA" }, include: { sources: true } }),
    db.budgetEntry.findMany({ where: { kind: { not: "SITUACAO_FINANCEIRA" } }, orderBy: { amountEur: "desc" } }),
    db.contract.findMany({
      where,
      include: { sources: true },
      orderBy: params.ordem === "valor" ? { priceEur: "desc" } : { signedAt: { sort: "desc", nulls: "last" } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.contract.count({ where }),
    db.contract.aggregate({ where, _sum: { priceEur: true } }),
    db.contract.groupBy({ by: ["procedureType"], where, _sum: { priceEur: true }, _count: { _all: true }, orderBy: { _sum: { priceEur: "desc" } } }),
    db.contract.groupBy({ by: ["supplierName"], where: { ...where, supplierIsPerson: false }, _sum: { priceEur: true }, _count: { _all: true }, orderBy: { _sum: { priceEur: "desc" } }, take: 6 }),
    db.contract.groupBy({ by: ["cpvLabel"], where: { ...where, cpvLabel: { not: null } }, _sum: { priceEur: true }, orderBy: { _sum: { priceEur: "desc" } }, take: 6 }),
    db.source.findMany({ where: { type: "ORCAMENTO" }, orderBy: { publishedAt: { sort: "desc", nulls: "last" } } }),
  ]);
  const allProcedures = await db.contract.findMany({ distinct: ["procedureType"], select: { procedureType: true }, orderBy: { procedureType: "asc" } });

  const asOf = facts[0]?.asOf;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const pageLink = (target: number) => {
    const query = new URLSearchParams(Object.entries({ ...params, pagina: String(target) }).filter(([, value]) => value) as [string, string][]);
    return `/transparencia?${query}`;
  };

  return (
    <>
      <PageHead title="Dados públicos" kicker={<KindLabel kind="REGISTO_OFICIAL" />}>
        <p>Dados oficiais reunidos para facilitar a consulta. A presença de um contrato ou fornecedor aqui não implica qualquer juízo sobre ele.</p>
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <section aria-labelledby="financeira">
          <h2 id="financeira" className="font-serif text-2xl font-semibold">Situação financeira do Município</h2>
          {asOf ? <p className="mt-1 text-sm text-muted">Dados a {formatDate(asOf)}, comunicados à Assembleia Municipal.</p> : null}
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.id} className="rounded-lg border border-line bg-surface p-4">
                <dt className="text-sm text-muted">{fact.label}</dt>
                <dd className="mt-1 font-serif text-2xl font-semibold tabular-nums">{formatEur(fact.amountEur)}</dd>
                {fact.note ? <dd className="mt-1 text-xs text-muted">{fact.note}</dd> : null}
                <dd className="mt-2 flex flex-wrap items-center gap-2"><OfficialBadge /><SourceChips sources={fact.sources} /></dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="orcamento">
          <h2 id="orcamento" className="font-serif text-2xl font-semibold">Orçamento</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Os mapas de receita e despesa são publicados em PDF pela Câmara. Os valores por rubrica entram aqui depois de transcritos e validados pela moderação.
          </p>
          <ul className="mt-3 grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
            {docs.map((doc) => (
              <li key={doc.id}><a href={doc.url} target="_blank" rel="noopener noreferrer" className="underline">{doc.title}</a></li>
            ))}
          </ul>
          {budget.length > 0 ? (
            <div className="mt-4">
              {budget.some((entry) => entry.isExample) ? <div className="mb-2"><ExampleBadge /></div> : null}
              <div className="grid gap-4 md:grid-cols-2">
                <Bars title="Principais rubricas de despesa, 2026" rows={budget.filter((entry) => entry.kind === "DESPESA").map((entry) => ({ label: entry.label, value: Number(entry.amountEur) }))} />
                <Bars title="Principais rubricas de receita, 2026" rows={budget.filter((entry) => entry.kind === "RECEITA").map((entry) => ({ label: entry.label, value: Number(entry.amountEur) }))} />
              </div>
            </div>
          ) : null}
        </section>

        <section aria-labelledby="contratos">
          <h2 id="contratos" className="font-serif text-2xl font-semibold">Contratos públicos</h2>
          <p className="mt-1 text-sm text-muted">Contratos do Município e dos SMAS registados no Portal BASE em 2026, a partir dos dados abertos do IMPIC.</p>

          <form method="get" className="mt-3 grid gap-3 rounded-lg border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <label className="text-sm font-medium">Pesquisar<input name="q" defaultValue={q} className="field mt-1" placeholder="Objeto ou fornecedor" /></label>
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
              </select>
            </label>
            <button type="submit" className="btn self-end">Aplicar</button>
          </form>

          <dl className="mt-4 flex flex-wrap gap-x-10 gap-y-2">
            <div><dt className="text-sm text-muted">Contratos</dt><dd className="font-serif text-2xl font-semibold tabular-nums">{formatNumber(count)}</dd></div>
            <div><dt className="text-sm text-muted">Valor contratual somado</dt><dd className="font-serif text-2xl font-semibold tabular-nums">{formatEur(sum._sum.priceEur ?? 0)}</dd></div>
          </dl>

          <h3 className="mt-6 font-semibold">Padrões a consultar</h3>
          <p className="text-sm text-muted">Somas descritivas para orientar a consulta. Não indicam qualquer irregularidade.</p>
          <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <Bars title="Por tipo de procedimento" rows={procedures.map((row) => ({ label: row.procedureType, value: Number(row._sum.priceEur ?? 0), detail: `${row._count._all} contratos` }))} />
            <Bars title="Por categoria CPV" rows={cpvs.map((row) => ({ label: row.cpvLabel ?? "Sem categoria", value: Number(row._sum.priceEur ?? 0) }))} />
            <Bars title="Por fornecedor" rows={suppliers.map((row) => ({ label: row.supplierName, value: Number(row._sum.priceEur ?? 0), detail: `${row._count._all} contratos` }))} />
          </div>

          <div className="relative mt-6 overflow-x-auto rounded-lg border border-line bg-surface">
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
                    <td className="px-3 py-2">{contract.title}<span className="block text-xs text-muted">{contract.procedureType}</span></td>
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
