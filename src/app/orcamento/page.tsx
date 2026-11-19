import type { Metadata } from "next";
import Link from "next/link";
import { Bars } from "@/components/Bars";
import { BudgetFigure } from "@/components/BudgetFigure";
import { CsvLink, KindLabel, LastUpdated, PageHead, pageSections } from "@/components/labels";
import { Disclosure, ExternalLink } from "@/components/civic";
import { SourceChips } from "@/components/Receipts";
import { StackedTable } from "@/components/StackedTable";
import { budgetOverview, GLOSSARY, PORTALS } from "@/lib/budget-copy";
import { groupBudgetDocs } from "@/lib/budget-docs";
import { amountOf, budgetYear, cashHistory, latestFinancialFacts } from "@/lib/budget-facts";
import { listBudgetDocuments, listBudgetEntries } from "@/lib/queries/budget";
import { formatDate, formatEur } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orçamento", description: "Orçamento, despesa e situação financeira do Município de Torres Vedras, com fontes oficiais." };

export default async function OrcamentoPage() {
  const [entries, docs] = await Promise.all([
    listBudgetEntries(),
    listBudgetDocuments(),
  ]);
  const summary = entries.filter((entry) => entry.kind === "RESUMO");
  const spending = entries.filter((entry) => entry.kind === "DESPESA");
  const revenue = entries.filter((entry) => entry.kind === "RECEITA");
  const financial = entries.filter((entry) => entry.kind === "SITUACAO_FINANCEIRA");
  const { asOf, facts } = latestFinancialFacts(financial);
  const history = cashHistory(financial);
  const updated = entries.map((entry) => entry.updatedAt).sort((a, b) => b.getTime() - a.getTime())[0];

  const year = budgetYear(summary);
  const summaryTitle = year ? `Orçamento de ${year}` : "Orçamento";
  const overview = budgetOverview({ summary, year, facts, asOf });
  const docGroups = groupBudgetDocs(docs);

  const amount = (entry: { approximate: boolean; amountEur: { toString(): string } }) =>
    `${entry.approximate ? "Cerca de " : ""}${formatEur(entry.amountEur)}`;

  const { nav, id: anchor } = pageSections({ "em-resumo": "Em resumo", resumo: summaryTitle, despesa: "Despesa e receita", financeira: "Dívida e dinheiro em caixa", documentos: "Documentos" });

  return (
    <>
      <PageHead
        title="Orçamento"
        kicker={<KindLabel kind="REGISTO_OFICIAL" />}
        sections={nav}
      >
        <p>Quanto o Município prevê gastar e a sua situação financeira, a partir de documentos da Assembleia Municipal. Valores aproximados aparecem com «cerca de».</p>
        <LastUpdated date={updated} className="mt-1" />
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        {overview.length > 0 ? (
          <section aria-labelledby={anchor["em-resumo"]} className="rounded-lg border border-line bg-record-soft p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id={anchor["em-resumo"]} className="font-serif text-2xl font-semibold">Em resumo</h2>
              <CsvLink href="/dados/orcamento.csv" />
            </div>
            <ul className="mt-2 max-w-3xl list-disc space-y-1 pl-5">
              {overview.map((line) => <li key={line}>{line}</li>)}
            </ul>
            <p className="mt-2 text-xs text-muted">Frases escritas por esta plataforma a partir dos valores oficiais que estão mais abaixo, cada um com a sua fonte.</p>
          </section>
        ) : <div className="flex justify-end"><CsvLink href="/dados/orcamento.csv" /></div>}

        <section aria-labelledby={anchor.resumo}>
          <h2 id={anchor.resumo} className="font-serif text-2xl font-semibold">{summaryTitle}</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {summary.map((entry) => <BudgetFigure key={entry.id} label={entry.label} value={amount(entry)} note={entry.note} sources={entry.sources} updatedAt={entry.updatedAt} />)}
          </dl>
        </section>

        <section aria-labelledby={anchor.despesa}>
          <h2 id={anchor.despesa} className="font-serif text-2xl font-semibold">Despesa e receita identificadas</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Valores que constam de documentos da Assembleia Municipal. Não são a totalidade do orçamento: os mapas completos de receita e despesa estão nos PDF da Câmara, ligados abaixo.
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Bars title="Despesa" rows={spending.map((entry) => ({ label: entry.label, value: amountOf(entry), detail: entry.approximate ? "Valor aproximado" : undefined }))} />
            <Bars title="Receita" rows={revenue.map((entry) => ({ label: entry.label, value: amountOf(entry) }))} />
          </div>
          <div className="mt-4">
          <Disclosure summary="Ver cada valor e a sua fonte">
          <StackedTable
            caption="Valores orçamentais e respetivas fontes"
            rows={[...spending, ...revenue]}
            rowKey={(entry) => entry.id}
            columns={[
              { label: "Designação", className: "md:w-[34%]", cell: (entry) => <>{entry.label}{entry.note ? <span className="block text-xs text-muted">{entry.note}</span> : null}<LastUpdated date={entry.updatedAt} /></> },
              { label: "Valor", right: true, gap: 1, className: "whitespace-nowrap tabular-nums", cell: (entry) => amount(entry) },
              { label: "Referência", gap: 1, className: "whitespace-nowrap text-muted", cell: (entry) => (entry.asOf ? formatDate(entry.asOf) : "—") },
              { label: "Fonte", gap: 2, cell: (entry) => <SourceChips sources={entry.sources} /> },
            ]}
          />
          </Disclosure>
          </div>
        </section>

        <section aria-labelledby={anchor.financeira}>
          <h2 id={anchor.financeira} className="font-serif text-2xl font-semibold">Dívida e dinheiro em caixa</h2>
          {asOf ? <p className="mt-1 text-sm text-muted">Dados a {formatDate(asOf)}, comunicados à Assembleia Municipal.</p> : null}
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map((fact) => <BudgetFigure key={fact.id} label={fact.label} value={formatEur(fact.amountEur)} note={fact.note} sources={fact.sources} updatedAt={fact.updatedAt} />)}
          </dl>
          <div className="mt-4 max-w-2xl">
            <Bars title="Dinheiro em caixa (disponibilidades) ao longo do tempo" rows={history.map((entry) => ({ label: formatDate(entry.asOf), value: amountOf(entry) }))} />
          </div>
        </section>

        <Disclosure summary="O que significam estes termos">
          <dl className="grid max-w-3xl gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            {GLOSSARY.map((item) => (
              <div key={item.term} className="contents">
                <dt className="font-semibold">{item.term}</dt>
                <dd>{item.text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted">Contexto geral escrito por esta plataforma, não retirado dos documentos.</p>
        </Disclosure>

        <section aria-labelledby={anchor.documentos}>
          <h2 id={anchor.documentos} className="font-serif text-2xl font-semibold">Documentos oficiais</h2>
          {docGroups.map(({ group, items }) => (
            <div key={group} className="mt-3">
              <h3 className="font-semibold">{group} <span className="font-normal text-muted">({items.length})</span></h3>
              <ul className="mt-1 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {items.map((doc) => <li key={doc.id}><ExternalLink href={doc.url}>{doc.label}</ExternalLink></li>)}
              </ul>
            </div>
          ))}
          <p className="mt-3 text-sm"><Link href="/fontes?tipo=ORCAMENTO" className="underline">Ver todos os documentos orçamentais</Link></p>
          <h3 className="mt-5 font-semibold">Portais oficiais</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {PORTALS.map((portal) => <li key={portal.url}><a href={portal.url} target="_blank" rel="noopener noreferrer" className="underline">{portal.label}</a></li>)}
          </ul>
        </section>
      </div>
    </>
  );
}
