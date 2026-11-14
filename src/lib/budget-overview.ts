import { formatDate } from "./format";
import { searchKey } from "./search";

/** Rótulos (sem acentos) das linhas da situação financeira, pela ordem em que se leem: primeiro o total e o limite, depois as partes. */
const FINANCIAL_KEYS = ["divida total da autarquia", "limite da divida", "medio e longo prazo", "curto prazo", "disponibilidades"] as const;
const [DEBT_KEY, LIMIT_KEY] = FINANCIAL_KEYS;
const CASH_KEY = "total de disponibilidades";

type Entry = { label: string; amountEur: { toString(): string }; asOf: Date | null; note: string | null };

const rank = (label: string) => {
  const index = FINANCIAL_KEYS.findIndex((key) => searchKey(label).includes(key));
  return index === -1 ? FINANCIAL_KEYS.length : index;
};

const findByKey = <T extends Entry>(list: T[], key: string) => list.find((entry) => searchKey(entry.label).includes(key));

const million = (value: number) => `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 }).format(value / 1_000_000)} milhões de euros`;
const percent = (value: number) => `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 }).format(value * 100)}%`;

/** Situação financeira na data mais recente, ordenada para leitura, e essa data. */
export function latestFinancialFacts<T extends Entry>(financial: T[]): { asOf: Date | undefined; facts: T[] } {
  const asOf = financial.map((entry) => entry.asOf).filter((date) => date !== null).sort((a, b) => b.getTime() - a.getTime())[0];
  const facts = financial.filter((entry) => entry.asOf?.getTime() === asOf?.getTime()).sort((a, b) => rank(a.label) - rank(b.label));
  return { asOf, facts };
}

/** Frases do resumo: só aparecem as que têm os valores nos registos. A percentagem é uma conta simples entre dois valores oficiais. */
export function budgetOverview(summary: Entry[], facts: Entry[], asOf: Date | undefined): string[] {
  const debt = findByKey(facts, DEBT_KEY);
  const limit = findByKey(facts, LIMIT_KEY);
  const cash = findByKey(facts, CASH_KEY);
  const budgetTotal = summary.reduce((sum, entry) => sum + Number(entry.amountEur), 0);
  return [
    summary.length > 0
      ? `O orçamento de 2026 soma cerca de ${million(budgetTotal)}: ${summary.map((entry) => `${entry.label.replace(/^Orçamento d[aeo]s? /, "")}, ${million(Number(entry.amountEur))}`).join("; ")}.`
      : null,
    debt && limit && Number(limit.amountEur) > 0
      ? `A dívida total comunicada é de ${million(Number(debt.amountEur))}, o que corresponde a ${percent(Number(debt.amountEur) / Number(limit.amountEur))} do limite da dívida total (${million(Number(limit.amountEur))}).${debt.note ? " Este valor está incompleto, segundo a própria fonte: ver a nota abaixo." : ""}`
      : null,
    cash && asOf ? `A ${formatDate(asOf)}, o Município tinha ${million(Number(cash.amountEur))} em caixa e contas bancárias.` : null,
  ].filter((line): line is string => Boolean(line));
}

export type DocGroup = { group: string; items: { id: string; url: string; label: string }[] };

/** Documentos agrupados pelo conjunto a que pertencem: «2025, Prestação de contas final: Balanço». */
export function groupBudgetDocs(docs: { id: string; url: string; title: string }[]): DocGroup[] {
  const groups = new Map<string, DocGroup["items"]>();
  for (const doc of docs) {
    const cut = doc.title.indexOf(": ");
    const group = cut > 0 ? doc.title.slice(0, cut) : "Outros documentos";
    groups.set(group, [...(groups.get(group) ?? []), { id: doc.id, url: doc.url, label: cut > 0 ? doc.title.slice(cut + 2) : doc.title }]);
  }
  return [...groups].map(([group, items]) => ({ group, items }));
}
