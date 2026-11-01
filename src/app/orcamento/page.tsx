import type { Metadata } from "next";
import Link from "next/link";
import { Bars } from "@/components/Bars";
import { CsvLink, KindLabel, LastUpdated, PageHead } from "@/components/labels";
import { OfficialBadge, SourceChips } from "@/components/Receipts";
import { db } from "@/lib/db";
import { formatDate, formatEur } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orçamento", description: "Orçamento, despesa e situação financeira do Município de Torres Vedras, com fontes oficiais." };

const HISTORY_LABEL = "Total de disponibilidades";

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
  const asOf = financial.map((entry) => entry.asOf).filter((date) => date !== null).sort((a, b) => b.getTime() - a.getTime())[0];
  const facts = financial.filter((entry) => entry.asOf?.getTime() === asOf?.getTime());
  const history = financial
    .filter((entry) => entry.label === HISTORY_LABEL)
    .sort((a, b) => a.asOf!.getTime() - b.asOf!.getTime());
  const updated = entries.map((entry) => entry.updatedAt).sort((a, b) => b.getTime() - a.getTime())[0];

  const amount = (entry: { approximate: boolean; amountEur: { toString(): string } }) =>
    `${entry.approximate ? "Cerca de " : ""}${formatEur(entry.amountEur)}`;

  return (
    <>
      <PageHead title="Orçamento" kicker={<KindLabel kind="REGISTO_OFICIAL" />}>
        <p>Valores comunicados à Assembleia Municipal e registados nas suas atas. Valores aproximados aparecem assinalados com «cerca de».</p>
        <LastUpdated date={updated} className="mt-1" />
      </PageHead>
      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <div className="flex justify-end"><CsvLink href="/dados/orcamento.csv" /></div>

        <section aria-labelledby="resumo">
          <h2 id="resumo" className="font-serif text-2xl font-semibold">Orçamento de 2026</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {summary.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-line bg-surface p-4">
                <dt className="text-sm text-muted">{entry.label}</dt>
                <dd className="mt-1 font-serif text-2xl font-semibold tabular-nums">{amount(entry)}</dd>
                {entry.note ? <dd className="mt-1 text-xs text-muted">{entry.note}</dd> : null}
                <dd className="mt-2 flex flex-wrap items-center gap-2"><OfficialBadge /><SourceChips sources={entry.sources} /></dd>
                <dd><LastUpdated date={entry.updatedAt} className="mt-2" /></dd>
              </div>
            ))}
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
          <div className="relative mt-4 overflow-x-auto rounded-lg border border-line bg-surface">
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
          </div>
        </section>

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
                <dd><LastUpdated date={fact.updatedAt} className="mt-2" /></dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 max-w-2xl">
            <Bars title="Disponibilidades ao longo do tempo" rows={history.map((entry) => ({ label: formatDate(entry.asOf!), value: Number(entry.amountEur) }))} />
          </div>
        </section>

        <section aria-labelledby="documentos">
          <h2 id="documentos" className="font-serif text-2xl font-semibold">Documentos oficiais</h2>
          <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm md:grid-cols-2">
            {docs.map((doc) => <li key={doc.id}><a href={doc.url} target="_blank" rel="noopener noreferrer" className="underline">{doc.title}</a></li>)}
          </ul>
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
