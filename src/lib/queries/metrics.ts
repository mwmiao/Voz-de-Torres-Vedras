import type { Metric } from "@prisma/client";
import { db } from "@/lib/db";

export function metricSeries(key: string, dimension = ""): Promise<Metric[]> {
  return db.metric.findMany({ where: { key, dimension }, orderBy: { period: "asc" } });
}

export function listMetrics() {
  return db.metric.findMany({ orderBy: [{ key: "asc" }, { period: "asc" }] });
}

export function listMetricsForExport() {
  return db.metric.findMany({ orderBy: [{ key: "asc" }, { period: "asc" }, { dimension: "asc" }] });
}
