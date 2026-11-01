import { headers } from "next/headers";
import { db } from "./db";
import { hashIp } from "./privacy";

export async function clientIpHash(): Promise<string> {
  const list = await headers();
  const ip = list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "desconhecido";
  return hashIp(ip);
}

/** Janela fixa guardada em PostgreSQL, para funcionar com mais do que uma instância. */
export async function hit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const row = await db.rateLimit.upsert({
    where: { key_windowStart: { key, windowStart } },
    update: { count: { increment: 1 } },
    create: { key, windowStart },
  });
  if (Math.random() < 0.01) {
    await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } } });
  }
  return row.count <= limit;
}

/** Sinal para a moderação: não bloqueia nem acusa, apenas regista para revisão. */
export async function abuseSignal(targetType: string, targetId: string, note: string) {
  await db.moderationEvent.create({ data: { action: "SINAL_ABUSO", targetType, targetId, note } });
}
