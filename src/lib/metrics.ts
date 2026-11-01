import type { Metric } from "@prisma/client";
import { db } from "./db";

export function metricSeries(key: string, dimension = ""): Promise<Metric[]> {
  return db.metric.findMany({ where: { key, dimension }, orderBy: { period: "asc" } });
}

export function latestMetric(series: Metric[], period: string): number | null {
  return series.find((row) => row.period === period)?.value ?? null;
}
