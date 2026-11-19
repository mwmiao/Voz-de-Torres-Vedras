import { db } from "@/lib/db";

/** Falha se a base de dados não responder. */
export async function pingDatabase(): Promise<void> {
  await db.$queryRaw`SELECT 1`;
}
