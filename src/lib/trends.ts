export type Trend = { direction: "up" | "down" | "flat" | "none"; text: string };

/** Abaixo desta variação, em percentagem, o valor conta como estável. */
const STABLE_PERCENT = 1;

const percent = (value: number) => new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 }).format(value);

/** Linguagem neutra: descreve o sentido da variação, sem o avaliar. */
export function compareValues(current: number | null | undefined, previous: number | null | undefined, previousLabel?: string): Trend {
  if (current === null || current === undefined || previous === null || previous === undefined || previous === 0) {
    return { direction: "none", text: "sem dados comparáveis" };
  }
  const change = ((current - previous) / previous) * 100;
  const reference = previousLabel ? ` face a ${previousLabel}` : "";
  if (Math.abs(change) < STABLE_PERCENT) return { direction: "flat", text: `manteve-se estável${reference}` };
  return change > 0
    ? { direction: "up", text: `aumentou ${percent(change)}%${reference}` }
    : { direction: "down", text: `diminuiu ${percent(Math.abs(change))}%${reference}` };
}
