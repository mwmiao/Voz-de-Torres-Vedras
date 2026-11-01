export const DEFAULT_MIN_PUBLIC_COUNT = 10;

export type AggregateOption = { id: string; label: string; count: number };
export type AggregateRow = AggregateOption & { percent: number };

export type Aggregate =
  | { visible: true; total: number; rows: AggregateRow[] }
  | { visible: false; total: null; minimum: number; rows: { id: string; label: string }[] };

/** Arredonda pelo maior resto, para que as percentagens somem sempre 100. */
function percentages(counts: number[], total: number): number[] {
  const exact = counts.map((count) => (count / total) * 100);
  const result = exact.map(Math.floor);
  const missing = 100 - result.reduce((sum, value) => sum + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < missing; i += 1) result[byRemainder[i].index] += 1;
  return result;
}

/**
 * Único ponto por onde as posições chegam às páginas públicas.
 * Abaixo do mínimo não se devolve nenhuma contagem, nem o total: com poucas
 * respostas, um número pequeno poderia identificar quem respondeu.
 */
export function buildAggregate(options: AggregateOption[], minimum = DEFAULT_MIN_PUBLIC_COUNT): Aggregate {
  const total = options.reduce((sum, option) => sum + option.count, 0);
  if (total < minimum) {
    return {
      visible: false,
      total: null,
      minimum,
      rows: options.map(({ id, label }) => ({ id, label })),
    };
  }
  const percents = percentages(options.map((option) => option.count), total);
  return {
    visible: true,
    total,
    rows: options.map((option, index) => ({ ...option, percent: percents[index] })),
  };
}
