import type { Summary } from "@prisma/client";
import { db } from "./db";

export async function summaryMap(entityType: string, keys: string[]): Promise<Map<string, Summary>> {
  const rows = await db.summary.findMany({ where: { entityType, entityKey: { in: keys } } });
  return new Map(rows.map((row) => [row.entityKey, row]));
}
