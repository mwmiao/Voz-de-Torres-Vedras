import type { Body, Outcome, Prisma } from "@prisma/client";
import { BODY_LABEL, OUTCOME_LABEL } from "./format";
import { searchKey } from "./search";

export type SearchParams = Record<string, string | undefined>;

/** Limite de `?pagina=`: muito além de qualquer lista real, e seguro para o `skip` do Prisma. */
const MAX_PAGE = 10_000;

/** Página pedida na ligação: um inteiro entre 1 e MAX_PAGE. Qualquer outro valor (texto, decimal, infinito) passa a 1. */
export function pageNumber(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1;
}

/** Só decisões com, pelo menos, uma fonte oficial chegam às páginas públicas. */
export const SOURCED_DECISION = { sources: { some: { official: true } } } as const;

export function decisionWhere(params: SearchParams): Prisma.DecisionWhereInput {
  const q = searchKey(params.q).trim();
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
    searchText: q ? { contains: q } : undefined,
  };
}

export function decisionOrder(params: SearchParams): Prisma.DecisionOrderByWithRelationInput[] {
  if (params.ordem === "antigas") return [{ meeting: { date: "asc" } }, { id: "asc" }];
  if (params.ordem === "titulo") return [{ title: "asc" }];
  return [{ meeting: { date: "desc" } }, { id: "asc" }];
}

export function contractWhere(params: SearchParams): Prisma.ContractWhereInput {
  const q = searchKey(params.q).trim();
  const year = /^\d{4}$/.test(params.ano ?? "") ? Number(params.ano) : undefined;
  return {
    signedAt: year ? { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } : undefined,
    awardingNif: params.entidade || undefined,
    procedureType: params.procedimento || undefined,
    // Nome exato, como vem do Portal BASE: é o que as ligações de fornecedor enviam.
    supplierName: params.fornecedor || undefined,
    searchText: q ? { contains: q } : undefined,
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
