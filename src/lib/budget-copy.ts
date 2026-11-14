import { amountOf, FACT_KEY, findFact, type Fact } from "./budget-facts";
import { formatDate } from "./format";

const number = new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 });
const million = (value: number) => `${number.format(value / 1_000_000)} milhões de euros`;
const percent = (value: number) => `${number.format(value * 100)}%`;

/** Nome do orçamento sem o prefixo: «Orçamento da Câmara» passa a «Câmara». */
const shortName = (label: string) => label.replace(/^Orçamento d[aeo]s? /, "");

/** Frases do resumo: só aparecem as que têm os valores nos registos. A percentagem é uma conta simples entre dois valores oficiais. */
export function budgetOverview({ summary, year, facts, asOf }: { summary: Fact[]; year: number | undefined; facts: Fact[]; asOf: Date | undefined }): string[] {
  const debt = findFact(facts, FACT_KEY.debt);
  const limit = findFact(facts, FACT_KEY.limit);
  const cash = findFact(facts, FACT_KEY.cash);
  const lines: string[] = [];

  if (summary.length > 0) {
    const total = summary.reduce((sum, entry) => sum + amountOf(entry), 0);
    const parts = summary.map((entry) => `${shortName(entry.label)}, ${million(amountOf(entry))}`).join("; ");
    lines.push(`O orçamento de ${year} soma cerca de ${million(total)}: ${parts}.`);
  }
  if (debt && limit && amountOf(limit) > 0) {
    const incomplete = debt.note ? " Este valor está incompleto, segundo a própria fonte: ver a nota abaixo." : "";
    lines.push(`A dívida total comunicada é de ${million(amountOf(debt))}, o que corresponde a ${percent(amountOf(debt) / amountOf(limit))} do limite da dívida total (${million(amountOf(limit))}).${incomplete}`);
  }
  if (cash && asOf) lines.push(`A ${formatDate(asOf)}, o Município tinha ${million(amountOf(cash))} em caixa e contas bancárias.`);
  return lines;
}
