import type { Body, Outcome, Prisma } from "@prisma/client";
import { BODY_LABEL, OUTCOME_LABEL } from "./format";

export type SearchParams = Record<string, string | undefined>;

/** Só decisões com, pelo menos, uma fonte oficial chegam às páginas públicas. */
export const SOURCED_DECISION = { sources: { some: { official: true } } } as const;

export function decisionWhere(params: SearchParams): Prisma.DecisionWhereInput {
  const q = params.q?.trim();
  const body = params.orgao && params.orgao in BODY_LABEL ? (params.orgao as Body) : undefined;
  const outcome = params.resultado && params.resultado in OUTCOME_LABEL ? (params.resultado as Outcome) : undefined;
  const year = /^\d{4}$/.test(params.ano ?? "") ? Number(params.ano) : undefined;
  return {
    ...SOURCED_DECISION,
    outcome,
    meeting: {
      body,
      date: year ? { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } : undefined,
    },
    OR: q
      ? [{ title: { contains: q, mode: "insensitive" } }, { proposalRef: { contains: q, mode: "insensitive" } }]
      : undefined,
  };
}

export function decisionOrder(params: SearchParams): Prisma.DecisionOrderByWithRelationInput[] {
  if (params.ordem === "antigas") return [{ meeting: { date: "asc" } }, { id: "asc" }];
  if (params.ordem === "titulo") return [{ title: "asc" }];
  return [{ meeting: { date: "desc" } }, { id: "asc" }];
}

export function contractWhere(params: SearchParams): Prisma.ContractWhereInput {
  const q = params.q?.trim();
  return {
    awardingNif: params.entidade || undefined,
    procedureType: params.procedimento || undefined,
    OR: q
      ? [{ title: { contains: q, mode: "insensitive" } }, { supplierName: { contains: q, mode: "insensitive" } }]
      : undefined,
  };
}

export function contractOrder(params: SearchParams): Prisma.ContractOrderByWithRelationInput {
  if (params.ordem === "valor") return { priceEur: "desc" };
  if (params.ordem === "fornecedor") return { supplierName: "asc" };
  return { signedAt: { sort: "desc", nulls: "last" } };
}

export function queryString(params: SearchParams, extra: SearchParams = {}): string {
  const entries = Object.entries({ ...params, ...extra }).filter((entry): entry is [string, string] => Boolean(entry[1]));
  return new URLSearchParams(entries).toString();
}

export function searchParamsObject(url: string): SearchParams {
  return Object.fromEntries(new URL(url).searchParams.entries());
}
