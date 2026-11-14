import { searchKey } from "./search";

/** Um valor oficial do orçamento ou da situação financeira, como vem da base de dados. */
export type Fact = { label: string; amountEur: { toString(): string }; asOf: Date | null; note: string | null };

export const amountOf = (fact: Pick<Fact, "amountEur">): number => Number(fact.amountEur);

/** Partes do rótulo (sem acentos) que identificam cada valor da situação financeira. */
export const FACT_KEY = {
  debt: "divida total da autarquia",
  limit: "limite da divida",
  /** O total, não as parcelas: por isso é mais específico do que a linha «disponibilidades» da ordem de leitura. */
  cash: "total de disponibilidades",
} as const;

/** Ordem em que a situação financeira se lê: primeiro o total e o limite, depois as partes. */
const READING_ORDER = [FACT_KEY.debt, FACT_KEY.limit, "medio e longo prazo", "curto prazo", "disponibilidades"];

const readingRank = (label: string) => {
  const key = searchKey(label);
  const index = READING_ORDER.findIndex((part) => key.includes(part));
  return index === -1 ? READING_ORDER.length : index;
};

export const findFact = <T extends Fact>(facts: T[], key: string): T | undefined => facts.find((fact) => searchKey(fact.label).includes(key));

/** Ano do orçamento: o dos registos de resumo. */
export const budgetYear = (summary: { year: number }[]): number | undefined => (summary.length > 0 ? Math.max(...summary.map((entry) => entry.year)) : undefined);

/** Evolução do dinheiro em caixa, da data mais antiga para a mais recente. */
export function cashHistory<T extends Fact>(financial: T[]): (T & { asOf: Date })[] {
  return financial
    .filter((fact): fact is T & { asOf: Date } => fact.asOf !== null && searchKey(fact.label).includes(FACT_KEY.cash))
    .sort((a, b) => a.asOf.getTime() - b.asOf.getTime());
}

/**
 * Situação financeira na data mais recente, pela ordem de leitura, e essa data.
 * Se nenhum valor tiver data, são todos mostrados e a data fica por indicar.
 */
export function latestFinancialFacts<T extends Fact>(financial: T[]): { asOf: Date | undefined; facts: T[] } {
  const times = financial.flatMap((fact) => (fact.asOf ? [fact.asOf.getTime()] : []));
  const latest = times.length > 0 ? Math.max(...times) : undefined;
  const current = latest === undefined ? financial : financial.filter((fact) => fact.asOf?.getTime() === latest);
  const facts = current
    .map((fact) => ({ fact, rank: readingRank(fact.label) }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ fact }) => fact);
  return { asOf: latest === undefined ? undefined : new Date(latest), facts };
}
