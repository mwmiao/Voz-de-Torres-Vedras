import { db } from "@/lib/db";
import { SOURCED_DECISION } from "@/lib/filters";

export function listIssues() {
  return db.issue.findMany({
    include: { _count: { select: { decisions: true, sources: true } } },
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });
}

export function findIssueMeta(slug: string) {
  return db.issue.findUnique({ where: { slug }, select: { title: true, summary: true } });
}

export function findIssue(slug: string) {
  return db.issue.findUnique({
    where: { slug },
    include: {
      dates: { orderBy: { date: "asc" } },
      sources: { orderBy: { publishedAt: "desc" } },
      claims: { include: { sources: true } },
      decisions: {
        where: SOURCED_DECISION,
        include: { meeting: true, sources: { where: { official: true } } },
        orderBy: { meeting: { date: "desc" } },
      },
    },
  });
}

export function listIssueSlugs() {
  return db.issue.findMany({ select: { slug: true, updatedAt: true } });
}
