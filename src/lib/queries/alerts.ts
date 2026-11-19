import type { Prisma } from "@prisma/client";
import { activeAlertWhere, expiredAlertWhere } from "@/lib/alerts";
import { db } from "@/lib/db";

/** Alertas ativos, sem limite: o total que a página mostra é o das ativas. */
export function listActiveAlerts(now: Date, where?: Prisma.AlertWhereInput) {
  return db.alert.findMany({ where: where ? { AND: [where, activeAlertWhere(now)] } : activeAlertWhere(now), orderBy: [{ startsAt: "desc" }] });
}

export function listExpiredAlerts(now: Date, where: Prisma.AlertWhereInput, page: number, pageSize: number) {
  return db.alert.findMany({ where: { AND: [where, expiredAlertWhere(now)] }, orderBy: { endsAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize });
}

export function countExpiredAlerts(now: Date, where: Prisma.AlertWhereInput) {
  return db.alert.count({ where: { AND: [where, expiredAlertWhere(now)] } });
}

export function lastAlertCheck() {
  return db.alert.aggregate({ _max: { lastCheckedAt: true } });
}

export function listAlertsForExport() {
  return db.alert.findMany({ orderBy: { retrievalDate: "desc" } });
}
