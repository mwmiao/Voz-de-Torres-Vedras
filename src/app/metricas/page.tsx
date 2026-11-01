import type { Metric, Outcome } from "@prisma/client";
import type { Metadata } from "next";
import { Bars } from "@/components/Bars";
import { Disclosure, EmptyState, ExternalLink, MetricCard, ScrollTable, SectionHead } from "@/components/civic";
import { CsvLink, LastUpdated, PageHead } from "@/components/labels";
import { db } from "@/lib/db";
import { formatEur, formatNumber, OUTCOME_LABEL } from "@/lib/format";
import { latestMetric } from "@/lib/metrics";
import { SOURCE_TYPE_LABEL } from "@/lib/sources";
import { compareValues } from "@/lib/trends";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Métricas", description: "Indicadores neutros sobre reuniões, decisões, contratos, orçamento e documentos de Torres Vedras, com fontes oficiais." };

const OFFICIAL_CONTRACTS = "https://dados.gov.pt/pt/datasets/contratos-publicos-portal-base-impic-contratos-de-2012-a-2026/";
const BUDGET_DOCS = "https://www.cm-tvedras.pt/documentos/gestao/";

const MISSING = [
  { label: "Execução orçamental por categoria e ano", text: "Os mapas estão em PDF que o site da Câmara exclui do acesso automático.", href: BUDGET_DOCS },
  { label: "Despesa e investimento aprovados por categoria", text: "Só existem valores parciais, comunicados à Assembleia Municipal, e sem série anual.", href: BUDGET_DOCS },
  { label: "Projetos municipais ativos", text: "Não encontrámos uma lista oficial com o estado de cada projeto.", href: "https://www.cm-tvedras.pt/artigos/projetos-cofinanciados-ue/" },
];

const yearOnly = (rows: Metric[]) => rows.filter((row) => /^\d{4}$/.test(row.period));

function byDimension(rows: Metric[], period: string) {
  return rows.filter((row) => row.period === period).sort((a, b) => b.value - a.value);
}

export default async function MetricasPage() {
  const metrics = await db.metric.findMany({ orderBy: [{ key: "asc" }, { period: "asc" }] });
  const updated = metrics.reduce<Date | null>((latest, row) => (!latest || row.retrievalDate > latest ? row.retrievalDate : latest), null);
  const of = (key: string, dimension = "") => metrics.filter((row) => row.key === key && row.dimension === dimension);
  const allOf = (key: string) => metrics.filter((row) => row.key === key);

  const year = new Date().getUTCFullYear();
  const complete = String(year - 1);
  const previous = String(year - 2);

  const contractsNumber = yearOnly(of("contratos-numero"));
  const contractsValue = yearOnly(of("contratos-valor"));
  const meetings = yearOnly(of("reunioes"));
  const average = (period: string) => {
    const count = latestMetric(contractsNumber, period);
    const value = latestMetric(contractsValue, period);
    return count && value ? value / count : null;
  };
  const decisionYears = [...new Set(allOf("decisoes").map((row) => row.period))].sort().reverse();
  const outcomes = (period: string) => allOf("decisoes").filter((row) => row.period === period);
  const suppliers = byDimension(allOf("contratos-fornecedor"), complete);
  const procedures = byDimension(allOf("contratos-procedimento"), complete);
  const budget = byDimension(allOf("orcamento"), String(year));
  const documents = allOf("documentos");
  const documentYears = [...new Set(documents.map((row) => row.period))].sort().reverse().slice(0, 5);
  const newRecords = of("registos-novos").slice(-12);
  const runs = of("execucoes").slice(-12);

  const contractSource = { href: OFFICIAL_CONTRACTS, label: "Portal BASE (IMPIC)" };
  const meetingSource = { href: "https://www.am-tvedras.pt/sessoes/editais/", label: "editais e atas" };

  return (
    <>
      <PageHead title="Métricas">
        <p>Indicadores simples sobre a atividade municipal. Descrevem valores e variações, sem os avaliar. O ano em curso está incompleto, por isso as comparações usam o último ano fechado.</p>
        <LastUpdated date={updated} className="mt-1" />
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <div className="flex justify-end"><CsvLink href="/dados/metricas.csv" label="Descarregar métricas em CSV" /></div>

        <section aria-labelledby="contratos">
          <SectionHead id="contratos" title="Contratos públicos">Contratos do Município e dos SMAS, pelo ano de celebração.</SectionHead>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label={`Contratos em ${complete}`} value={formatNumber(latestMetric(contractsNumber, complete) ?? 0)} trend={compareValues(latestMetric(contractsNumber, complete), latestMetric(contractsNumber, previous), previous)} source={contractSource} updated={updated} />
            <MetricCard label={`Valor total em ${complete}`} value={formatEur(latestMetric(contractsValue, complete) ?? 0)} trend={compareValues(latestMetric(contractsValue, complete), latestMetric(contractsValue, previous), previous)} source={contractSource} updated={updated} />
            <MetricCard label={`Valor médio em ${complete}`} value={formatEur(average(complete) ?? 0)} trend={compareValues(average(complete), average(previous), previous)} source={contractSource} updated={updated} />
          </dl>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Bars title="Contratos por ano" unit="Contratos" format={formatNumber} rows={contractsNumber.map((row) => ({ label: row.period === String(year) ? `${row.period} (ano em curso)` : row.period, value: row.value }))} />
            <Bars title={`Contratos por tipo de procedimento, ${complete}`} unit="Contratos" format={formatNumber} rows={procedures.map((row) => ({ label: row.dimension, value: row.value }))} />
            <Bars title={`Fornecedores com maior valor, ${complete}`} rows={suppliers.map((row) => ({ label: row.dimension, value: row.value }))} />
          </div>
          <p className="mt-2 text-sm text-muted">Somas descritivas. A presença de um fornecedor nesta lista não implica qualquer juízo. Pessoas singulares não são apresentadas.</p>
        </section>

        <section aria-labelledby="reunioes">
          <SectionHead id="reunioes" title="Reuniões e decisões">Inclui apenas o que foi transcrito de documentos oficiais. As decisões do Executivo Municipal estão incompletas, porque constam de PDF de acesso restrito a robôs.</SectionHead>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label={`Reuniões em ${complete}`} value={formatNumber(latestMetric(meetings, complete) ?? 0)} trend={compareValues(latestMetric(meetings, complete), latestMetric(meetings, previous), previous)} source={meetingSource} updated={updated} />
          </dl>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Bars title="Reuniões por ano" unit="Reuniões" format={formatNumber} rows={meetings.map((row) => ({ label: row.period, value: row.value }))} />
            {decisionYears.length > 0 ? (
              <ScrollTable label="Decisões por ano e resultado">
                <table className="w-full text-left text-sm">
                  <caption className="p-3 text-left font-semibold">Decisões por ano e resultado</caption>
                  <thead className="bg-paper text-xs text-muted">
                    <tr><th scope="col" className="px-3 py-2">Ano</th><th scope="col" className="px-3 py-2">Resultado</th><th scope="col" className="px-3 py-2 text-right">Decisões</th></tr>
                  </thead>
                  <tbody>
                    {decisionYears.flatMap((period) => outcomes(period).map((row) => (
                      <tr key={row.id} className="border-t border-line">
                        <th scope="row" className="px-3 py-1.5 text-left font-normal">{period}</th>
                        <td className="px-3 py-1.5">{OUTCOME_LABEL[row.dimension as Outcome]}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(row.value)}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </ScrollTable>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="orcamento">
          <SectionHead id="orcamento" title="Orçamento">Valores identificados em documentos da Assembleia Municipal. Não são o orçamento completo.</SectionHead>
          {budget.length > 0 ? <div className="mt-3 max-w-3xl"><Bars title={`Valores orçamentais identificados, ${year}`} rows={budget.map((row) => ({ label: row.dimension, value: row.value }))} /></div> : <div className="mt-3"><EmptyState title="Sem dados comparáveis." /></div>}
          <p className="mt-2 text-sm"><ExternalLink href="/orcamento">Ver orçamento e fontes de cada valor</ExternalLink></p>
        </section>

        <section aria-labelledby="documentos">
          <SectionHead id="documentos" title="Documentos publicados">Contagem pela data de publicação no site de origem. Documentos antigos colocados de novo online contam no ano dessa publicação.</SectionHead>
          <ScrollTable label="Documentos publicados por ano e tipo">
            <table className="mt-0 w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">Documentos oficiais publicados por ano e tipo</caption>
              <thead className="bg-paper text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Ano</th>
                  {(["REGULAMENTO", "EDITAL", "ATA", "MINUTA", "ORCAMENTO"] as const).map((type) => <th key={type} scope="col" className="px-3 py-2 text-right">{SOURCE_TYPE_LABEL[type]}</th>)}
                </tr>
              </thead>
              <tbody>
                {documentYears.map((period) => (
                  <tr key={period} className="border-t border-line">
                    <th scope="row" className="px-3 py-1.5 text-left font-normal">{period}</th>
                    {(["REGULAMENTO", "EDITAL", "ATA", "MINUTA", "ORCAMENTO"] as const).map((type) => (
                      <td key={type} className="px-3 py-1.5 text-right tabular-nums">{formatNumber(documents.find((row) => row.period === period && row.dimension === type)?.value ?? 0)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          <p className="mt-2 text-sm"><ExternalLink href="/fontes">Consultar todos os documentos</ExternalLink></p>
        </section>

        <section aria-labelledby="atualizacao">
          <SectionHead id="atualizacao" title="Atualização dos dados" />
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Bars title="Registos novos por mês" unit="Registos" format={formatNumber} rows={newRecords.map((row) => ({ label: row.period, value: row.value }))} />
            <Bars title="Consultas às fontes por mês" unit="Consultas" format={formatNumber} rows={runs.map((row) => ({ label: row.period, value: row.value }))} />
          </div>
          <p className="mt-2 text-sm"><ExternalLink href="/estado-das-fontes">Ver o estado de cada fonte</ExternalLink></p>
        </section>

        <Disclosure summary={`Indicadores sem dados disponíveis (${MISSING.length})`}>
          <ul className="space-y-2 text-sm">
            {MISSING.map((item) => (
              <li key={item.label}>
                <strong>{item.label}.</strong> {item.text} <ExternalLink href={item.href}>Página oficial</ExternalLink>
              </li>
            ))}
          </ul>
        </Disclosure>
      </div>
    </>
  );
}
