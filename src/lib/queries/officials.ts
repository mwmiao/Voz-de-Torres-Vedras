import { db } from "@/lib/db";

export function listActiveOfficials() {
  return db.official.findMany({ where: { active: true }, include: { sources: true }, orderBy: [{ order: "asc" }, { name: "asc" }] });
}

export function listCommittees() {
  return db.committee.findMany({
    include: { sources: true, members: { include: { official: true }, orderBy: [{ isChair: "desc" }, { official: { name: "asc" } }] } },
    orderBy: { name: "asc" },
  });
}

export function findOfficialMeta(slug: string) {
  return db.official.findUnique({ where: { slug }, select: { name: true, role: true } });
}

export function findOfficial(slug: string) {
  return db.official.findUnique({
    where: { slug },
    include: {
      sources: true,
      memberships: { include: { committee: true } },
      votes: { include: { decision: { include: { meeting: true, sources: { where: { official: true } } } } } },
    },
  });
}

export function listOfficialSlugs() {
  return db.official.findMany({ where: { active: true }, select: { slug: true, updatedAt: true } });
}
