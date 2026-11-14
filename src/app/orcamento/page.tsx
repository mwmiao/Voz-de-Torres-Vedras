import type { Metadata } from "next";
import Link from "next/link";
import { Bars } from "@/components/Bars";
import { BudgetFigure } from "@/components/BudgetFigure";
import { CsvLink, KindLabel, LastUpdated, PageHead } from "@/components/labels";
import { Disclosure, ExternalLink, ScrollTable } from "@/components/civic";
import { SourceChips } from "@/components/Receipts";
import { budgetOverview, budgetYear, cashHistory, groupBudgetDocs, latestFinancialFacts } from "@/lib/budget-overview";
import { db } from "@/lib/db";
import { formatDate, formatEur } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orçamento", description: "Orçamento, despesa e situação financeira do Município de Torres Vedras, com fontes oficiais." };

/** Contexto geral escrito por esta plataforma, não retirado dos documentos. */
const GLOSSARY = [
  { term: "SMAS", text: "Serviços Municipalizados de Água e Saneamento. Têm orçamento próprio, aprovado em conjunto com o da Câmara." },
  { term: "Despesas de capital", text: "Investimento: obras, edifícios, equipamentos e terrenos. O resto é despesa corrente, como salários, energia e serviços." },
  { term: "Saldo de gerência", text: "Dinheiro que sobrou do ano anterior e que é somado ao orçamento do ano em curso, numa revisão orçamental." },
  { term: "Revisão orçamental", text: "Alteração ao orçamento durante o ano, aprovada pela Assembleia Municipal." },
  { term: "Disponibilidades", text: "Dinheiro em caixa e em contas bancárias numa certa data." },
  { term: "Dívida de médio e longo prazo", text: "Empréstimos e locações a pagar em mais de um ano." },
  { term: "Limite da dívida total", text: "Valor máximo de dívida que a lei permite ao Município, calculado a partir da receita dos últimos anos." },
];

const PORTALS = [
  { label: "Documentos de gestão da Câmara Municipal", url: "https://www.cm-tvedras.pt/documentos/gestao/" },
  { label: "Transparência no site da Câmara", url: "https://www.cm-tvedras.pt/transparencia" },
  { label: "Portal da Transparência", url: "https://transparencia.gov.pt/" },
  { label: "Diário da República", url: "https://diariodarepublica.pt/" },
];

export default async function OrcamentoPage() {
  const [entries, docs] = await Promise.all([
    db.budgetEntry.findMany({ include: { sources: true }, orderBy: [{ amountEur: "desc" }] }),
    db.source.findMany({ where: { type: "ORCAMENTO", official: true }, orderBy: { publishedAt: { sort: "desc", nulls: "last" } }, take: 24 }),
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
  const overview = budgetOverview(summary, facts, asOf);
  const docGroups = groupBudgetDocs(docs);

  const amount = (entry: { approximate: boolean; amountEur: { toString(): string } }) =>
    `${entry.approximate ? "Cerca de " : ""}${formatEur(entry.amountEur)}`;

  return (
    <>
      <PageHead
        title="Orçamento"
        kicker={<KindLabel kind="REGISTO_OFICIAL" />}
        sections={[
          { href: "#em-resumo", label: "Em resumo" },
          { href: "#resumo", label: summaryTitle },
          { href: "#despesa", label: "Despesa e receita" },
          { href: "#financeira", label: "Dívida e dinheiro em caixa" },
          { href: "#documentos", label: "Documentos" },
        ]}
      >
        <p>Quanto o Município prevê gastar e a sua situação financeira, a partir de documentos da Assembleia Municipal. Valores aproximados aparecem com «cerca de».</p>
        <LastUpdated date={updated} className="mt-1" />
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        {overview.length > 0 ? (
          <section aria-labelledby="em-resumo" className="rounded-lg border border-line bg-record-soft p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="em-resumo" className="font-serif text-2xl font-semibold">Em resumo</h2>
              <CsvLink href="/dados/orcamento.csv" />
            </div>
            <ul className="mt-2 max-w-3xl list-disc space-y-1 pl-5">
              {overview.map((line) => <li key={line}>{line}</li>)}
            </ul>
            <p className="mt-2 text-xs text-muted">Frases escritas por esta plataforma a partir dos valores oficiais que estão mais abaixo, cada um com a sua fonte.</p>
          </section>
        ) : <div className="flex justify-end"><CsvLink href="/dados/orcamento.csv" /></div>}

        <section aria-labelledby="resumo">
          <h2 id="resumo" className="font-serif text-2xl font-semibold">{summaryTitle}</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {summary.map((entry) => <BudgetFigure key={entry.id} label={entry.label} value={amount(entry)} note={entry.note} sources={entry.sources} updatedAt={entry.updatedAt} />)}
          </dl>
        </section>

        <section aria-labelledby="despesa">
          <h2 id="despesa" className="font-serif text-2xl font-semibold">Despesa e receita identificadas</h2>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Valores que constam de documentos da Assembleia Municipal. Não são a totalidade do orçamento: os mapas completos de receita e despesa estão nos PDF da Câmara, ligados abaixo.
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <Bars title="Despesa" rows={spending.map((entry) => ({ label: entry.label, value: Number(entry.amountEur), detail: entry.approximate ? "Valor aproximado" : undefined }))} />
            <Bars title="Receita" rows={revenue.map((entry) => ({ label: entry.label, value: Number(entry.amountEur) }))} />
          </div>
          <div className="mt-4">
          <Disclosure summary="Ver cada valor e a sua fonte">
          <ScrollTable label="Valores orçamentais e respetivas fontes">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Valores orçamentais e respetivas fontes</caption>
              <thead className="bg-paper text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2">Designação</th>
                  <th scope="col" className="px-3 py-2 text-right">Valor</th>
                  <th scope="col" className="px-3 py-2">Referência</th>
                  <th scope="col" className="px-3 py-2">Fonte</th>
                </tr>
              </thead>
              <tbody>
                {[...spending, ...revenue].map((entry) => (
                  <tr key={entry.id} className="border-t border-line align-top">
                    <td className="px-3 py-2">{entry.label}{entry.note ? <span className="block text-xs text-muted">{entry.note}</span> : null}<LastUpdated date={entry.updatedAt} /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{amount(entry)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-muted">{entry.asOf ? formatDate(entry.asOf) : "—"}</td>
                    <td className="px-3 py-2"><SourceChips sources={entry.sources} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
          </Disclosure>
          </div>
        </section>

        <section aria-labelledby="financeira">
          <h2 id="financeira" className="font-serif text-2xl font-semibold">Dívida e dinheiro em caixa</h2>
          {asOf ? <p className="mt-1 text-sm text-muted">Dados a {formatDate(asOf)}, comunicados à Assembleia Municipal.</p> : null}
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {facts.map((fact) => <BudgetFigure key={fact.id} label={fact.label} value={formatEur(fact.amountEur)} note={fact.note} sources={fact.sources} updatedAt={fact.updatedAt} />)}
          </dl>
          <div className="mt-4 max-w-2xl">
            <Bars title="Dinheiro em caixa (disponibilidades) ao longo do tempo" rows={history.map((entry) => ({ label: formatDate(entry.asOf), value: Number(entry.amountEur) }))} />
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

        <section aria-labelledby="documentos">
          <h2 id="documentos" className="font-serif text-2xl font-semibold">Documentos oficiais</h2>
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
