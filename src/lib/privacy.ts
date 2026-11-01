import { createHash, createHmac, randomBytes } from "node:crypto";

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "yopmail.com",
  "trashmail.com",
  "sharklasers.com",
  "getnada.com",
  "dispostable.com",
]);

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET em falta ou demasiado curto.");
  }
  return "segredo-apenas-para-desenvolvimento";
}

/**
 * Forma canónica do email, para que variantes da mesma caixa de correio
 * (maiúsculas, etiquetas "+", pontos no Gmail) não criem contas duplicadas.
 */
export function normalizeEmail(email: string): string {
  const [rawLocal, rawDomain] = email.trim().toLowerCase().split("@");
  if (!rawLocal || !rawDomain) return "";
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  let local = rawLocal.split("+")[0];
  if (domain === "gmail.com") local = local.replaceAll(".", "");
  return `${local}@${domain}`;
}

export function isDisposableEmail(email: string): boolean {
  return DISPOSABLE_DOMAINS.has(email.split("@")[1] ?? "");
}

export function hashEmail(normalizedEmail: string): string {
  return createHmac("sha256", secret()).update(`email:${normalizedEmail}`).digest("hex");
}

/** O sal muda todos os dias, por isso o IP não permite seguir ninguém ao longo do tempo. */
export function hashIp(ip: string, date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return createHmac("sha256", secret()).update(`ip:${day}:${ip}`).digest("hex").slice(0, 32);
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function emailListHashes(list: string | undefined): Set<string> {
  return new Set(
    (list ?? "")
      .split(",")
      .map((item) => normalizeEmail(item))
      .filter(Boolean)
      .map(hashEmail),
  );
}
