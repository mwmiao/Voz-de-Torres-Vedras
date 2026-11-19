import type { Metric } from "@prisma/client";
export { metricSeries } from "./queries/metrics";

export function latestMetric(series: Metric[], period: string): number | null {
  return series.find((row) => row.period === period)?.value ?? null;
}
