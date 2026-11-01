import type { Body, Outcome, SourceRunStatus, UpdateCategory, VoteMode } from "@prisma/client";

const TIME_ZONE = "Europe/Lisbon";

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "long", timeZone: TIME_ZONE }).format(date);
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)}, ${formatTime(date)}`;
}

export function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("pt-PT", { dateStyle: "short", timeZone: TIME_ZONE }).format(date);
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-PT", { timeStyle: "short", timeZone: TIME_ZONE }).format(date).replace(":", "h");
}

export function formatEur(value: number | string | { toString(): string }): string {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", useGrouping: "always" }).format(Number(value.toString()));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-PT", { useGrouping: "always" }).format(value);
}

export const BODY_LABEL: Record<Body, string> = {
  ASSEMBLEIA_MUNICIPAL: "Assembleia Municipal",
  EXECUTIVO_MUNICIPAL: "Executivo Municipal",
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
  ADIADO: "Adiado",
  RETIRADO: "Retirado",
  TOMADA_CONHECIMENTO: "Tomada de conhecimento",
  REMETIDO: "Remetido a comissão",
  POR_PUBLICAR: "Deliberação por publicar",
};

export const UPDATE_CATEGORY_LABEL: Record<UpdateCategory, string> = {
  CONTRATO: "Contrato",
  ORCAMENTO: "Orçamento",
  REUNIAO: "Reunião",
  DOCUMENTO: "Documento",
  ELEITO: "Eleitos",
  SEGURANCA: "Segurança",
  ALERTA: "Alerta",
};

export const RUN_STATUS_LABEL: Record<SourceRunStatus, string> = {
  OK: "Sem erros",
  PARCIAL: "Parcial, com registos recusados",
  ERRO: "Falhou",
  NUNCA_EXECUTADA: "Ainda não executada",
};

export function voteSummary(decision: {
  voteMode: VoteMode;
  votesFor: number | null;
  votesAgainst: number | null;
  abstentions: number | null;
}): string {
  if (decision.votesFor !== null) {
    const parts = [`${decision.votesFor} a favor`];
    parts.push(`${decision.votesAgainst ?? 0} contra`);
    parts.push(`${decision.abstentions ?? 0} ${decision.abstentions === 1 ? "abstenção" : "abstenções"}`);
    return parts.join(" · ");
  }
  if (decision.voteMode === "UNANIMIDADE") return "Unanimidade";
  if (decision.voteMode === "MAIORIA") return "Maioria (contagem não publicada no edital)";
  return "Sem votação publicada";
}
