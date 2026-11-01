import type { Prisma } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { Bars } from "@/components/Bars";
import { Disclosure, EmptyState, ExternalLink, MetricCard, ScrollTable, SectionHead, TrendText } from "@/components/civic";
import { CsvLink, LastUpdated, PageHead } from "@/components/labels";
import { db } from "@/lib/db";
import { queryString, type SearchParams } from "@/lib/filters";
import { formatDate, formatNumber } from "@/lib/format";
import { CRIME_DISCLAIMER, CRIME_LIMITATIONS, formatRate, panorama, rateOf } from "@/lib/safety";
import { searchKey } from "@/lib/search";
import { compareValues } from "@/lib/trends";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Segurança", description: "Crimes registados no concelho de Torres Vedras, por ano e categoria, com fontes oficiais." };

const OFFICIAL_LINKS = [
  { label: "INE: crimes registados (NUTS 2024)", url: "https://www.ine.pt/xurl/indx/0012261/PT" },
  { label: "INE: taxa de criminalidade (NUTS 2024)", url: "https://www.ine.pt/xurl/indx/0012260/PT" },
  { label: "Estatísticas da Justiça (DGPJ)", url: "https://estatisticas.justica.gov.pt/" },
  { label: "Relatório Anual de Segurança Interna", url: "https://www.ssi.gov.pt/publicacoes/relatorio-anual-de-seguranca-interna" },
];

const FREGUESIA_NOTICE = "Não há dados oficiais publicados por freguesia. Mostramos os valores do concelho.";

export default async function SegurancaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const detailed = params.vista === "detalhada";
  const [records, categories, freguesias, population] = await Promise.all([
    db.crimeRecord.findMany({ include: { category: true }, orderBy: [{ year: "desc" }, { category: { order: "asc" } }] }),
    db.crimeCategory.findMany({ orderBy: { order: "asc" } }),
    db.freguesia.findMany({ orderBy: { name: "asc" } }),
    db.populationEstimate.findMany({ orderBy: { year: "desc" } }),
  ]);
  const years = [...new Set(records.map((record) => record.year))].sort((a, b) => b - a);
  const latest = years[0];
  const previous = years[1];
  const updated = records.reduce<Date | null>((date, record) => (!date || record.retrievalDate > date ? record.retrievalDate : date), null);
  const selectedFreguesia = freguesias.find((item) => item.slug === params.freguesia);

  const head = (
    <PageHead title="Segurança">
      <p>Crimes registados no concelho de Torres Vedras, com dados anuais do INE e da Direção-Geral da Política de Justiça.</p>
      <LastUpdated date={updated} className="mt-1" />
    </PageHead>
  );

  if (!latest) {
    return (
      <>
        {head}
        <div className="mx-auto max-w-6xl px-4 py-8"><EmptyState title="Os dados de segurança ainda não foram recolhidos.">Voltarão a ser consultados na próxima atualização.</EmptyState></div>
      </>
    );
  }

  const total = records.find((record) => record.categoryCode === "T" && record.year === latest);
  const totalBefore = records.find((record) => record.categoryCode === "T" && record.year === previous);
  const totalRate = total ? rateOf(total) : null;
  const populationLatest = population[0] ?? null;

  const trends = categories.filter((category) => category.code !== "T").flatMap((category) => {
    const current = records.find((record) => record.categoryCode === category.code && record.year === latest);
    if (!current) return [];
    const before = records.find((record) => record.categoryCode === category.code && record.year === previous);
    return [{ category, current, trend: compareValues(current.count, before?.count, String(previous)) }];
  });

  // Vista detalhada
  const q = searchKey(params.q).trim();
  const filteredYear = /^\d{4}$/.test(params.ano ?? "") ? Number(params.ano) : undefined;
  const where: Prisma.CrimeRecordWhereInput = { year: filteredYear, categoryCode: params.categoria || undefined, sourceUrl: params.fonte || undefined };
  const rows = detailed
    ? (await db.crimeRecord.findMany({ where, include: { category: true }, orderBy: [{ year: "desc" }, { category: { order: "asc" } }] })).filter((row) => !q || searchKey(row.category.name).includes(q))
    : [];
  const sources = [...new Set(records.map((record) => record.sourceUrl))];
  const chartCode = params.categoria || "T";
  const chartName = categories.find((category) => category.code === chartCode)?.name ?? "Total";
  const chart = records.filter((record) => record.categoryCode === chartCode && record.count !== null).sort((a, b) => a.year - b.year);

  return (
    <>
      {head}
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <p className="rounded-lg border border-line bg-record-soft p-4 font-medium">{CRIME_DISCLAIMER}</p>

        <nav aria-label="Vistas de segurança" className="flex gap-2">
          <Link href="/seguranca" aria-current={!detailed ? "page" : undefined} className={!detailed ? "btn no-underline" : "btn-quiet no-underline"}>Vista simples</Link>
          <Link href="/seguranca?vista=detalhada" aria-current={detailed ? "page" : undefined} className={detailed ? "btn no-underline" : "btn-quiet no-underline"}>Vista detalhada</Link>
        </nav>

        {!detailed ? (
          <>
            <section aria-labelledby="panorama">
              <SectionHead id="panorama" title="Panorama de segurança" />
              <div className="mt-2 max-w-3xl space-y-1">
                {panorama(records, populationLatest?.population ?? null).map((sentence) => <p key={sentence}>{sentence}</p>)}
              </div>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard label={`Crimes registados em ${latest}`} value={formatNumber(total?.count ?? 0)} trend={compareValues(total?.count, totalBefore?.count, String(previous))} source={{ href: total?.sourceUrl ?? OFFICIAL_LINKS[0].url, label: "INE e DGPJ" }} updated={updated} />
                {totalRate ? <MetricCard label={`Taxa de criminalidade em ${latest}`} value={formatRate(totalRate.value)} note="Crimes por 1 000 residentes" source={{ href: OFFICIAL_LINKS[1].url, label: "INE e DGPJ" }} updated={updated} /> : null}
                {populationLatest ? <MetricCard label={`População residente em ${populationLatest.year}`} value={formatNumber(populationLatest.population)} note="Estimativa do INE" source={{ href: populationLatest.sourceUrl, label: "INE" }} updated={populationLatest.retrievalDate} /> : null}
              </dl>
            </section>

            <section aria-labelledby="categorias">
              <SectionHead id="categorias" title={`Categorias em ${latest}`}>Variação face a {previous}.</SectionHead>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {trends.map(({ category, current, trend }) => (
                  <li key={category.code} className="rounded-lg border border-line bg-surface p-3">
                    <p className="font-medium">{category.name}</p>
                    <p className="text-sm">{current.confidential ? "Valor oculto pelo INE" : `${formatNumber(current.count ?? 0)} registos`}</p>
                    <TrendText trend={trend} />
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="freguesia">
              <SectionHead id="freguesia" title="Na minha freguesia" />
              <form method="get" className="mt-3 flex max-w-xl flex-wrap items-end gap-2">
                <label className="min-w-0 flex-1 text-sm font-medium">Escolha a freguesia
                  <select name="freguesia" defaultValue={params.freguesia ?? ""} className="field mt-1">
                    <option value="">Selecione</option>
                    {freguesias.map((freguesia) => <option key={freguesia.slug} value={freguesia.slug}>{freguesia.name}</option>)}
                  </select>
                </label>
                <button type="submit" className="btn">Ver</button>
              </form>
              {selectedFreguesia ? (
                <div className="mt-3 rounded-lg border border-line bg-surface p-4" role="status">
                  <p className="font-semibold">{selectedFreguesia.name}</p>
                  <p className="mt-1 text-sm">As entidades oficiais não publicam crimes registados por freguesia, pelo que não existe resumo para {selectedFreguesia.name}. Os valores acima dizem respeito a todo o concelho.</p>
                  <p className="mt-2 text-sm"><Link href={`/alertas?area=${encodeURIComponent(selectedFreguesia.name)}`} className="underline">Ver alertas para esta freguesia</Link></p>
                </div>
              ) : <p className="mt-2 text-sm text-muted">{FREGUESIA_NOTICE}</p>}
            </section>
          </>
        ) : (
          <section aria-labelledby="detalhe" className="space-y-4">
            <SectionHead id="detalhe" title="Dados detalhados" action={<CsvLink href={`/dados/seguranca.csv?${queryString({ ano: params.ano, categoria: params.categoria })}`} />} />
            <Disclosure summary="Filtrar dados" open={Boolean(params.ano || params.categoria || params.fonte || params.q || params.freguesia)}>
          <form role="search" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.5fr_1fr_1fr_auto]">
              <input type="hidden" name="vista" value="detalhada" />
              <label className="text-sm font-medium">Pesquisar categoria<input name="q" defaultValue={params.q ?? ""} className="field mt-1" /></label>
              <label className="text-sm font-medium">Ano
                <select name="ano" defaultValue={params.ano ?? ""} className="field mt-1">
                  <option value="">Todos</option>
                  {years.map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Categoria
                <select name="categoria" defaultValue={params.categoria ?? ""} className="field mt-1">
                  <option value="">Todas</option>
                  {categories.map((category) => <option key={category.code} value={category.code}>{category.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Freguesia
                <select name="freguesia" defaultValue={params.freguesia ?? ""} className="field mt-1">
                  <option value="">Concelho</option>
                  {freguesias.map((freguesia) => <option key={freguesia.slug} value={freguesia.slug}>{freguesia.name}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Fonte
                <select name="fonte" defaultValue={params.fonte ?? ""} className="field mt-1">
                  <option value="">Todas</option>
                  {sources.map((source) => <option key={source} value={source}>{source.includes("0012261") ? "INE, série NUTS 2024" : "INE, série NUTS 2013"}</option>)}
                </select>
              </label>
              <button type="submit" className="btn self-end">Aplicar</button>
            </form>
        </Disclosure>

            {selectedFreguesia ? <p role="status" className="rounded-lg border border-line bg-surface p-3 text-sm">{selectedFreguesia.name}: {FREGUESIA_NOTICE}</p> : null}

            <div className="max-w-3xl"><Bars title={`${chartName}: evolução anual`} unit="Crimes registados" format={formatNumber} rows={chart.map((record) => ({ label: String(record.year), value: record.count ?? 0 }))} /></div>
            {!filteredYear && !selectedFreguesia ? null : <p className="text-sm text-muted">O gráfico mostra a categoria escolhida em todos os anos, para permitir a comparação.</p>}

            {rows.length > 0 ? (
              <ScrollTable label="Crimes registados por ano e categoria">
                <table className="w-full min-w-[46rem] text-left text-sm">
                  <caption className="sr-only">Crimes registados no concelho de Torres Vedras, por ano e categoria, com contagem, taxa e fonte</caption>
                  <thead className="bg-paper text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2">Ano</th>
                      <th scope="col" className="px-3 py-2">Área</th>
                      <th scope="col" className="px-3 py-2">Categoria</th>
                      <th scope="col" className="px-3 py-2 text-right">Contagem</th>
                      <th scope="col" className="px-3 py-2 text-right">Taxa por 1 000 residentes</th>
                      <th scope="col" className="px-3 py-2">Fonte</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const rate = rateOf(row);
                      return (
                        <tr key={row.id} className="border-t border-line align-top">
                          <th scope="row" className="px-3 py-2 text-left font-normal">{row.year}</th>
                          <td className="px-3 py-2">Concelho</td>
                          <td className="px-3 py-2">{row.category.name}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.confidential ? <abbr title="Valor oculto por segredo estatístico">x</abbr> : formatNumber(row.count ?? 0)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {rate ? <>{formatRate(rate.value)}<span className="block text-xs text-muted">{rate.official ? "INE" : `Calculada, população de ${row.populationYear}`}</span></> : "—"}
                          </td>
                          <td className="px-3 py-2"><ExternalLink href={row.sourceUrl}>INE {row.sourceUrl.match(/\d{7}/)?.[0]}</ExternalLink></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollTable>
            ) : (
              <EmptyState title="Nenhum dado corresponde aos filtros."><Link href="/seguranca?vista=detalhada" className="underline">Limpar filtros</Link></EmptyState>
            )}
          </section>
        )}

        <Disclosure summary="Como ler estes dados: fontes e limitações">
          <ul className="max-w-3xl list-disc space-y-1 pl-5 text-sm">
            {CRIME_LIMITATIONS.map((item) => <li key={item}>{item}</li>)}
          </ul>
          {total?.publicationDate ? <p className="mt-2 text-sm text-muted">Última publicação do INE: {formatDate(total.publicationDate)}.</p> : null}
          <h3 className="mt-3 text-sm font-semibold">Fontes oficiais</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {OFFICIAL_LINKS.map((link) => <li key={link.url}><ExternalLink href={link.url}>{link.label}</ExternalLink></li>)}
          </ul>
        </Disclosure>
      </div>
    </>
  );
}
