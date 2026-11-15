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

/** Contexto geral escrito por esta plataforma, não retirado dos documentos. */
export const GLOSSARY = [
  { term: "SMAS", text: "Serviços Municipalizados de Água e Saneamento. Têm orçamento próprio, aprovado em conjunto com o da Câmara." },
  { term: "Despesas de capital", text: "Investimento: obras, edifícios, equipamentos e terrenos. O resto é despesa corrente, como salários, energia e serviços." },
  { term: "Saldo de gerência", text: "Dinheiro que sobrou do ano anterior e que é somado ao orçamento do ano em curso, numa revisão orçamental." },
  { term: "Revisão orçamental", text: "Alteração ao orçamento durante o ano, aprovada pela Assembleia Municipal." },
  { term: "Disponibilidades", text: "Dinheiro em caixa e em contas bancárias numa certa data." },
  { term: "Dívida de médio e longo prazo", text: "Empréstimos e locações a pagar em mais de um ano." },
  { term: "Limite da dívida total", text: "Valor máximo de dívida que a lei permite ao Município, calculado a partir da receita dos últimos anos." },
];

export const PORTALS = [
  { label: "Documentos de gestão da Câmara Municipal", url: "https://www.cm-tvedras.pt/documentos/gestao/" },
  { label: "Transparência no site da Câmara", url: "https://www.cm-tvedras.pt/transparencia" },
  { label: "Portal da Transparência", url: "https://transparencia.gov.pt/" },
  { label: "Diário da República", url: "https://diariodarepublica.pt/" },
];
