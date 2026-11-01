"use server";

import type { IssueStatus, ProposalStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModerator } from "@/lib/auth";
import { DEFAULT_OPTIONS } from "@/lib/categories";
import { db } from "@/lib/db";
import { importBaseContracts, importDecisions } from "@/lib/import/run";
import { slugify } from "@/lib/import/records";
import { isOfficialUrl } from "@/lib/sources";

async function logEvent(actorId: string, action: string, targetType: string, targetId: string, note?: string) {
  await db.moderationEvent.create({ data: { actorId, action, targetType, targetId, note } });
}

export async function reviewProposal(formData: FormData) {
  const moderator = await requireModerator();
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision"));
  const note = String(formData.get("note") ?? "").trim() || null;

  if (decision === "promover") {
    const proposal = await db.topicProposal.findUniqueOrThrow({ where: { id } });
    const issue = await db.issue.create({
      data: {
        slug: `${slugify(proposal.title)}-${id.slice(-5)}`,
        title: proposal.title,
        category: proposal.category,
        summary: proposal.description,
        stage: "Em preparação pela moderação",
        status: "RASCUNHO",
        options: { create: DEFAULT_OPTIONS.map((label, order) => ({ label, order })) },
      },
    });
    await db.topicProposal.update({ where: { id }, data: { status: "PROMOVIDA", issueId: issue.id, moderatorNote: note } });
    await logEvent(moderator.id, "PROPOSTA_PROMOVIDA", "TopicProposal", id, note ?? undefined);
    redirect(`/moderacao/temas/${issue.id}`);
  }

  const statuses: Record<string, ProposalStatus> = {
    aprovar: "A_RECOLHER_APOIOS",
    recusar: "RECUSADA",
    duplicada: "DUPLICADA",
  };
  const status = statuses[decision];
  if (!status) return;
  await db.topicProposal.update({ where: { id }, data: { status, moderatorNote: note } });
  await logEvent(moderator.id, `PROPOSTA_${status}`, "TopicProposal", id, note ?? undefined);
  revalidatePath("/moderacao/propostas");
  revalidatePath("/temas/emergentes");
}

export async function saveIssue(formData: FormData) {
  const moderator = await requireModerator();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as IssueStatus;
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  const sourceTitle = String(formData.get("sourceTitle") ?? "").trim();

  await db.issue.update({
    where: { id },
    data: {
      title: String(formData.get("title")).trim(),
      summary: String(formData.get("summary")).trim(),
      stage: String(formData.get("stage")).trim(),
    },
  });

  // Opções fixas assim que houver posições, para não alterar o sentido de respostas já dadas.
  const positions = await db.position.count({ where: { issueId: id } });
  const options = String(formData.get("options") ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (positions === 0 && options.length >= 2) {
    await db.issueOption.deleteMany({ where: { issueId: id } });
    await db.issueOption.createMany({ data: options.map((label, order) => ({ issueId: id, label, order })) });
  }

  if (sourceUrl) {
    if (!isOfficialUrl(sourceUrl) || !sourceTitle) redirect(`/moderacao/temas/${id}?erro=fonte`);
    const source = await db.source.upsert({
      where: { url: sourceUrl },
      update: {},
      create: { name: "Fonte oficial", title: sourceTitle, url: sourceUrl, type: "PAGINA_OFICIAL", retrievedAt: new Date() },
    });
    await db.issue.update({ where: { id }, data: { sources: { connect: { id: source.id } } } });
  }

  if (status === "ATIVO") {
    const official = await db.source.count({ where: { official: true, issues: { some: { id } } } });
    if (official === 0) redirect(`/moderacao/temas/${id}?erro=sem-fonte`);
  }
  await db.issue.update({ where: { id }, data: { status } });
  await logEvent(moderator.id, "TEMA_GUARDADO", "Issue", id, `Estado: ${status}`);
  revalidatePath("/temas");
  redirect("/moderacao/temas");
}

export async function resolveReport(formData: FormData) {
  const moderator = await requireModerator();
  const id = String(formData.get("id"));
  const accept = formData.get("decision") === "resolver";
  const report = await db.report.update({ where: { id }, data: { status: accept ? "RESOLVIDA" : "REJEITADA" } });
  if (accept && report.targetType === "TopicProposal") {
    await db.topicProposal.updateMany({ where: { id: report.targetId }, data: { status: "RECUSADA", moderatorNote: "Removida após denúncia." } });
    revalidatePath("/temas/emergentes");
  }
  await logEvent(moderator.id, accept ? "DENUNCIA_RESOLVIDA" : "DENUNCIA_REJEITADA", "Report", id);
  revalidatePath("/moderacao/denuncias");
}

export async function reviewClaim(formData: FormData) {
  const moderator = await requireModerator();
  const id = String(formData.get("id"));
  if (formData.get("decision") === "remover") {
    await db.claim.delete({ where: { id } });
    await logEvent(moderator.id, "AFIRMACAO_REMOVIDA", "Claim", id, "Sem fonte verificável");
  } else {
    const url = String(formData.get("sourceUrl") ?? "").trim();
    const title = String(formData.get("sourceTitle") ?? "").trim();
    if (!isOfficialUrl(url) || !title) redirect("/moderacao/denuncias?erro=fonte");
    const source = await db.source.upsert({
      where: { url },
      update: {},
      create: { name: "Fonte oficial", title, url, type: "PAGINA_OFICIAL", retrievedAt: new Date() },
    });
    await db.claim.update({ where: { id }, data: { sources: { connect: { id: source.id } } } });
    await logEvent(moderator.id, "AFIRMACAO_VERIFICADA", "Claim", id);
  }
  revalidatePath("/moderacao/denuncias");
}

export async function saveSettings(formData: FormData) {
  const moderator = await requireModerator();
  for (const key of ["proposal_threshold", "min_public_count"]) {
    const value = Number(formData.get(key));
    if (!Number.isInteger(value) || value < 1) redirect("/moderacao/importacao?erro=definicoes");
    if (key === "min_public_count" && value < 5) redirect("/moderacao/importacao?erro=definicoes");
    await db.appSetting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
  }
  await logEvent(moderator.id, "DEFINICOES_ALTERADAS", "AppSetting", "geral");
  revalidatePath("/moderacao/importacao");
}

export async function uploadImport(formData: FormData) {
  await requireModerator();
  const file = formData.get("file");
  const kind = String(formData.get("kind"));
  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  if (!(file instanceof File) || file.size === 0) redirect("/moderacao/importacao?erro=ficheiro");
  const content = await file.text();
  try {
    if (kind === "base") await importBaseContracts(db, file.name, content);
    else {
      if (!isOfficialUrl(sourceUrl)) redirect("/moderacao/importacao?erro=origem");
      await importDecisions(db, file.name, content, sourceUrl);
    }
  } catch (error) {
    if (error instanceof SyntaxError) redirect("/moderacao/importacao?erro=formato");
    throw error;
  }
  revalidatePath("/moderacao/importacao");
  redirect("/moderacao/importacao?concluida=1");
}
