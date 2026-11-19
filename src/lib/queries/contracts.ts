import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export function listContracts(where: Prisma.ContractWhereInput, orderBy: Prisma.ContractOrderByWithRelationInput, page: number, pageSize: number) {
  return db.contract.findMany({
    where,
    include: { sources: true, modifications: { orderBy: { date: "desc" } } },
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
}

export function contractStats(where: Prisma.ContractWhereInput) {
  return db.contract.aggregate({ where, _count: { _all: true }, _sum: { priceEur: true }, _max: { updatedAt: true } });
}

export function contractsByProcedure(where: Prisma.ContractWhereInput) {
  return db.contract.groupBy({ by: ["procedureType"], where, _sum: { priceEur: true }, _count: { _all: true }, orderBy: { _sum: { priceEur: "desc" } } });
}

export function topContractSuppliers(where: Prisma.ContractWhereInput) {
  return db.contract.groupBy({ by: ["supplierName"], where: { ...where, supplierIsPerson: false }, _sum: { priceEur: true }, _count: { _all: true }, orderBy: { _sum: { priceEur: "desc" } }, take: 6 });
}

export function topContractCpvs(where: Prisma.ContractWhereInput) {
  return db.contract.groupBy({ by: ["cpvLabel"], where: { ...where, cpvLabel: { not: null } }, _sum: { priceEur: true }, orderBy: { _sum: { priceEur: "desc" } }, take: 6 });
}

export function listProcedureTypes() {
  return db.contract.findMany({ distinct: ["procedureType"], select: { procedureType: true }, orderBy: { procedureType: "asc" } });
}

export function listContractSignedDates() {
  return db.contract.findMany({ select: { signedAt: true } });
}

export function listLatestContracts(take: number) {
  return db.contract.findMany({ orderBy: { signedAt: { sort: "desc", nulls: "last" } }, take });
}

export function listContractsForExport(where: Prisma.ContractWhereInput, orderBy: Prisma.ContractOrderByWithRelationInput) {
  return db.contract.findMany({ where, include: { sources: true }, orderBy });
}
