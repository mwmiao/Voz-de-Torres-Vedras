"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { CATEGORIES } from "@/lib/categories";
import { LOGIN_TOKEN_MINUTES, endSession, requireUser, roleForEmailHash, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendLoginEmail } from "@/lib/email";
import { hashEmail, hashToken, isDisposableEmail, newToken, normalizeEmail } from "@/lib/privacy";
import { getProposalThreshold } from "@/lib/queries";
import { abuseSignal, clientIpHash, hit } from "@/lib/ratelimit";

function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value ?? "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/conta";
}

export async function requestLogin(formData: FormData) {
  const raw = String(formData.get("email") ?? "");
  const next = safeNext(formData.get("seguinte"));
  const email = normalizeEmail(raw);

  if (!z.email().safeParse(raw.trim()).success || !email) redirect("/entrar?erro=email");
  if (formData.get("consentimento") !== "on") redirect("/entrar?erro=consentimento");
  if (isDisposableEmail(email)) redirect("/entrar?erro=descartavel");

  const ip = await clientIpHash();
  const emailHash = hashEmail(email);
  const allowed = (await hit(`login:ip:${ip}`, 10, 3600)) && (await hit(`login:email:${emailHash}`, 5, 3600));
  if (!allowed) redirect("/entrar?erro=limite");

  const token = newToken();
  await db.loginToken.create({
    data: { tokenHash: hashToken(token), emailHash, expiresAt: new Date(Date.now() + LOGIN_TOKEN_MINUTES * 60 * 1000) },
  });
  const base = process.env.APP_URL ?? "http://localhost:1400";
  const query = new URLSearchParams({ token, seguinte: next });
  await sendLoginEmail(raw.trim(), `${base}/entrar/verificar?${query}`);
  redirect("/entrar?enviado=1");
}

export async function confirmLogin(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const next = safeNext(formData.get("seguinte"));
  const tokenHash = hashToken(token);
  const row = await db.loginToken.findUnique({ where: { tokenHash } });
  if (!row || row.usedAt || row.expiresAt < new Date()) redirect("/entrar?erro=ligacao");

  // Marcação atómica: a mesma ligação não pode abrir duas sessões.
  const claimed = await db.loginToken.updateMany({ where: { tokenHash, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count === 0) redirect("/entrar?erro=ligacao");

  const role = roleForEmailHash(row.emailHash);
  const existing = await db.user.findUnique({ where: { emailHash: row.emailHash } });
  const user = await db.user.upsert({
    where: { emailHash: row.emailHash },
    update: { role },
    create: { emailHash: row.emailHash, role },
  });
  if (!existing) {
    const ip = await clientIpHash();
    if (!(await hit(`signup:ip:${ip}`, 5, 86400))) {
      await abuseSignal("User", user.id, "Várias contas novas a partir do mesmo endereço no mesmo dia.");
    }
  }
  await startSession(user.id);
  redirect(next);
}

export async function logout() {
  await endSession();
  redirect("/");
}

export async function setPosition(formData: FormData) {
  const issueId = String(formData.get("issueId") ?? "");
  const optionId = String(formData.get("optionId") ?? "");
  const issue = await db.issue.findFirst({
    where: { id: issueId, status: "ATIVO", isExample: false, options: { some: { id: optionId } } },
  });
  if (!issue) redirect("/temas");
  const user = await requireUser(`/temas/${issue.slug}`);
  const path = `/temas/${issue.slug}`;

  if (!(await hit(`position:${user.id}`, 40, 3600))) redirect(`${path}?erro=limite`);
  if (!(await hit(`position:${user.id}:${issue.id}`, 6, 3600))) {
    await abuseSignal("Issue", issue.id, "Muitas alterações de posição no mesmo tema em pouco tempo.");
    redirect(`${path}?erro=limite`);
  }

  await db.position.upsert({
    where: { userId_issueId: { userId: user.id, issueId: issue.id } },
    update: { optionId },
    create: { userId: user.id, issueId: issue.id, optionId },
  });
  revalidatePath(path);
  redirect(`${path}?registada=1#posicao`);
}

export async function removePosition(formData: FormData) {
  const user = await requireUser();
  const issueId = String(formData.get("issueId") ?? "");
  await db.position.deleteMany({ where: { userId: user.id, issueId } });
  const next = safeNext(formData.get("seguinte"));
  revalidatePath(next);
  redirect(next);
}

const proposalSchema = z.object({
  title: z.string().trim().min(10).max(140),
  description: z.string().trim().min(30).max(1500),
  category: z.enum(CATEGORIES),
});

export async function submitProposal(formData: FormData) {
  const user = await requireUser("/temas/emergentes");
  const parsed = proposalSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
  });
  if (!parsed.success) redirect("/temas/emergentes?erro=dados");
  if (!(await hit(`proposal:${user.id}`, 3, 86400))) redirect("/temas/emergentes?erro=limite");
  await db.topicProposal.create({ data: { ...parsed.data, authorId: user.id } });
  redirect("/temas/emergentes?enviada=1");
}

export async function toggleSupport(formData: FormData) {
  const proposalId = String(formData.get("proposalId") ?? "");
  const user = await requireUser("/temas/emergentes");
  const proposal = await db.topicProposal.findFirst({ where: { id: proposalId, status: "A_RECOLHER_APOIOS" } });
  if (!proposal) redirect("/temas/emergentes");
  if (!(await hit(`support:${user.id}`, 30, 3600))) redirect("/temas/emergentes?erro=limite");

  const key = { userId_proposalId: { userId: user.id, proposalId } };
  if (await db.proposalSupport.findUnique({ where: key })) {
    await db.proposalSupport.delete({ where: key });
  } else {
    await db.proposalSupport.create({ data: { userId: user.id, proposalId } });
    const [supports, threshold] = await Promise.all([
      db.proposalSupport.count({ where: { proposalId } }),
      getProposalThreshold(),
    ]);
    if (supports >= threshold) {
      await db.topicProposal.update({ where: { id: proposalId }, data: { status: "EM_REVISAO" } });
    }
  }
  revalidatePath("/temas/emergentes");
  redirect("/temas/emergentes");
}

export async function reportContent(formData: FormData) {
  const user = await requireUser("/temas/emergentes");
  const targetId = String(formData.get("targetId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500) || "Sem motivo indicado";
  if (!(await hit(`report:${user.id}`, 10, 86400))) redirect("/temas/emergentes?erro=limite");
  await db.report.create({ data: { targetType: "TopicProposal", targetId, reason, reporterId: user.id } });
  redirect("/temas/emergentes?denuncia=1");
}

export async function exportMyData() {
  const user = await requireUser();
  const positions = await db.position.findMany({
    where: { userId: user.id },
    include: { issue: { select: { title: true } }, option: { select: { label: true } } },
  });
  const proposals = await db.topicProposal.findMany({
    where: { authorId: user.id },
    select: { title: true, description: true, status: true, createdAt: true },
  });
  const supports = await db.proposalSupport.findMany({ where: { userId: user.id }, select: { proposal: { select: { title: true } }, createdAt: true } });
  return JSON.stringify(
    {
      conta: { criadaEm: user.createdAt, consentimentoEm: user.consentedAt, papel: user.role },
      nota: "O seu email não está guardado em claro; só existe um valor irreversível que o identifica.",
      posicoes: positions.map((position) => ({ tema: position.issue.title, posicao: position.option.label, atualizadaEm: position.updatedAt })),
      propostas: proposals,
      apoios: supports.map((support) => ({ proposta: support.proposal.title, em: support.createdAt })),
    },
    null,
    2,
  );
}

export async function deleteAccount(formData: FormData) {
  const user = await requireUser();
  if (formData.get("confirmar") !== "APAGAR") redirect("/conta?erro=confirmar");
  await endSession();
  await db.user.delete({ where: { id: user.id } });
  redirect("/?conta=apagada");
}
