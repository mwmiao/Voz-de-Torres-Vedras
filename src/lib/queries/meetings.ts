import type { Body, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { SOURCED_DECISION } from "@/lib/filters";

export function listDecisions(where: Prisma.DecisionWhereInput, orderBy: Prisma.DecisionOrderByWithRelationInput[], page: number, pageSize: number) {
  return db.decision.findMany({
    where,
    include: { meeting: true, sources: { where: { official: true } } },
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
}

export function countDecisions(where: Prisma.DecisionWhereInput) {
  return db.decision.count({ where });
}

export function latestDecisionUpdate() {
  return db.decision.aggregate({ _max: { updatedAt: true } });
}

export function listDecisionsForExport(where: Prisma.DecisionWhereInput, orderBy: Prisma.DecisionOrderByWithRelationInput[]) {
  return db.decision.findMany({
    where,
    include: { meeting: true, sources: { where: { official: true } } },
    orderBy,
  });
}

/** As decisões mais recentes que já têm resultado, para a página inicial. */
export function listLatestDecidedDecisions(take: number) {
  return db.decision.findMany({
    where: { ...SOURCED_DECISION, outcome: { notIn: ["POR_PUBLICAR", "TOMADA_CONHECIMENTO"] } },
    include: { meeting: true },
    orderBy: [{ meeting: { date: "desc" } }, { id: "asc" }],
    take,
  });
}

export function listMeetingsWithCounts() {
  return db.meeting.findMany({
    include: { sources: { where: { official: true } }, _count: { select: { decisions: true } } },
    orderBy: { date: "desc" },
  });
}

export function listMeetingsForExport() {
  return db.meeting.findMany({ include: { sources: true }, orderBy: { date: "desc" } });
}

export function findNextMeeting(body: Body, now: Date) {
  return db.meeting.findFirst({ where: { body, date: { gte: now } }, orderBy: { date: "asc" } });
}

export function findLastMeeting(body: Body, now: Date) {
  return db.meeting.findFirst({ where: { body, date: { lt: now } }, orderBy: { date: "desc" } });
}

export function findMeetingTitle(slug: string) {
  return db.meeting.findUnique({ where: { slug }, select: { title: true } });
}

export function findMeeting(slug: string) {
  return db.meeting.findUnique({
    where: { slug },
    include: {
      sources: { orderBy: { publishedAt: "desc" } },
      decisions: { where: SOURCED_DECISION, include: { meeting: true, sources: { where: { official: true } } } },
    },
  });
}

export function listMeetingSlugs() {
  return db.meeting.findMany({ select: { slug: true, updatedAt: true } });
}
