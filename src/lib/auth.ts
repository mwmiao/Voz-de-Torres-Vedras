import type { Role, User } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { emailListHashes, hashToken, newToken } from "./privacy";

const COOKIE = "voz_sessao";
const SESSION_DAYS = 30;

export const LOGIN_TOKEN_MINUTES = 30;

export const currentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export async function requireUser(next = "/conta"): Promise<User> {
  const user = await currentUser();
  if (!user) redirect(`/entrar?seguinte=${encodeURIComponent(next)}`);
  return user;
}

export async function requireModerator(): Promise<User> {
  const user = await requireUser("/moderacao");
  if (user.role === "USER") redirect("/");
  return user;
}

export function roleForEmailHash(emailHash: string): Role {
  if (emailListHashes(process.env.ADMIN_EMAILS).has(emailHash)) return "ADMIN";
  if (emailListHashes(process.env.MODERATOR_EMAILS).has(emailHash)) return "MODERATOR";
  return "USER";
}

export async function startSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // Em http://localhost:1400 um cookie seguro não seria guardado.
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  jar.delete(COOKIE);
}
