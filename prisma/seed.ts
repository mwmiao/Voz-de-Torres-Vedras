import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { importBaseContracts } from "../src/lib/import/run";
import { slugify } from "../src/lib/import/records";
import { isOfficialUrl } from "../src/lib/sources";
import {
  ASSEMBLY_BOARD,
  ASSEMBLY_DEPUTIES,
  BUDGET,
  CASH_HISTORY,
  COMMITTEES,
  DECISIONS,
  EXECUTIVE,
  ISSUES,
  MEETINGS,
  PARISH_PRESIDENTS,
  RETRIEVED_AT,
  SOURCES,
  VOTE_COUNTS,
} from "./data/real";

const db = new PrismaClient();

const refs = (keys: string[], ids: Map<string, string>) =>
  keys.map((key) => {
    const id = ids.get(key);
    if (!id) throw new Error(`Fonte desconhecida: ${key}`);
    return { id };
  });

const connect = (keys: string[], ids: Map<string, string>) => ({ connect: refs(keys, ids) });

async function seedSources(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const { key, publishedAt, ...source } of SOURCES) {
    if (!isOfficialUrl(source.url, source.type)) throw new Error(`Fonte sem domínio oficial: ${source.url}`);
    const fields = { ...source, publishedAt: publishedAt ? new Date(publishedAt) : null, retrievedAt: RETRIEVED_AT };
    const row = await db.source.upsert({ where: { url: source.url }, update: fields, create: fields });
    ids.set(key, row.id);
  }
  return ids;
}

async function seedOfficials(ids: Map<string, string>) {
  const people = [
    ...EXECUTIVE.map((person, order) => ({ ...person, body: "EXECUTIVO_MUNICIPAL" as const, order, parish: null, source: "cm-composicao" })),
    ...ASSEMBLY_BOARD.map((person, order) => ({ ...person, body: "ASSEMBLEIA_MUNICIPAL" as const, order, portfolios: [], parish: null, source: "am-composicao" })),
    ...ASSEMBLY_DEPUTIES.map((name) => ({ name, role: "Deputado/a municipal", party: null, body: "ASSEMBLEIA_MUNICIPAL" as const, order: 10, portfolios: [], parish: null, source: "am-ata-1-2026" })),
    ...PARISH_PRESIDENTS.map((person) => ({ ...person, role: "Presidente de Junta de Freguesia", body: "ASSEMBLEIA_MUNICIPAL" as const, order: 50, portfolios: [], source: "am-composicao" })),
  ];
  for (const { source, ...person } of people) {
    const fields = { ...person, slug: slugify(person.name), updatedAt: RETRIEVED_AT, sources: connect([source], ids) };
    await db.official.upsert({ where: { slug: fields.slug }, update: fields, create: fields });
  }
  for (const committee of COMMITTEES) {
    const slug = slugify(committee.name);
    const row = await db.committee.upsert({
      where: { slug },
      update: {},
      create: { slug, name: committee.name, body: "ASSEMBLEIA_MUNICIPAL", sources: connect(["am-comissoes"], ids) },
    });
    const names = committee.chair ? [committee.chair, ...committee.members] : committee.members;
    for (const name of names) {
      const official = await db.official.findUniqueOrThrow({ where: { slug: slugify(name) } });
      const isChair = name === committee.chair;
      await db.committeeMembership.upsert({
        where: { committeeId_officialId: { committeeId: row.id, officialId: official.id } },
        update: { isChair },
        create: { committeeId: row.id, officialId: official.id, isChair },
      });
    }
  }
}

async function seedRecord(ids: Map<string, string>) {
  for (const { sources, date, ...meeting } of MEETINGS) {
    const fields = { ...meeting, date: new Date(date), updatedAt: RETRIEVED_AT, sources: connect(sources, ids) };
    await db.meeting.upsert({ where: { slug: meeting.slug }, update: fields, create: fields });
  }
  for (const group of DECISIONS) {
    const meeting = await db.meeting.findUniqueOrThrow({ where: { slug: group.meeting } });
    for (const [itemNumber, proposalRef, title, outcome, voteMode, extra = []] of group.rows) {
      const slug = slugify(`${group.meeting} ${title}`);
      const fields = {
        meetingId: meeting.id,
        itemNumber,
        proposalRef,
        title,
        outcome,
        voteMode,
        updatedAt: RETRIEVED_AT,
        sources: connect([group.source, ...extra], ids),
      };
      await db.decision.upsert({ where: { slug }, update: fields, create: { ...fields, slug } });
    }
  }

  for (const [fragment, votesFor, votesAgainst, abstentions, voteNote, source] of VOTE_COUNTS) {
    const { count } = await db.decision.updateMany({
      where: { title: { contains: fragment } },
      data: { votesFor, votesAgainst, abstentions, voteNote },
    });
    if (count !== 1) throw new Error(`Votação ambígua: ${fragment} (${count})`);
    await db.decision.update({
      where: { id: (await db.decision.findFirstOrThrow({ where: { title: { contains: fragment } } })).id },
      data: { sources: connect([source!], ids) },
    });
  }

  // Voto nominal registado na Ata n.º 1/2026.
  const climate = await db.decision.findFirstOrThrow({ where: { title: { contains: "alterações climáticas" } } });
  const abstained = await db.official.findUniqueOrThrow({ where: { slug: "herculano-manuel-cosme-raposo" } });
  await db.voteRecord.upsert({
    where: { decisionId_officialId: { decisionId: climate.id, officialId: abstained.id } },
    update: {},
    create: { decisionId: climate.id, officialId: abstained.id, choice: "ABSTENCAO" },
  });
}

async function seedIssues(ids: Map<string, string>) {
  for (const issue of ISSUES) {
    const decisions = await db.decision.findMany({
      where: { OR: issue.decisions.map((fragment) => ({ title: { contains: fragment } })) },
      select: { id: true },
    });
    const fields = {
      title: issue.title,
      category: issue.category,
      summary: issue.summary,
      stage: issue.stage,
      updatedAt: RETRIEVED_AT,
    };
    const row = await db.issue.upsert({
      where: { slug: issue.slug },
      update: { ...fields, decisions: { set: decisions }, sources: { set: refs(issue.sources, ids) } },
      create: { ...fields, slug: issue.slug, decisions: { connect: decisions }, sources: connect(issue.sources, ids) },
    });
    await db.issueDate.deleteMany({ where: { issueId: row.id } });
    await db.claim.deleteMany({ where: { issueId: row.id } });
    await db.issueDate.createMany({
      data: issue.dates.map(({ date, label }) => ({ issueId: row.id, date: new Date(`${date}T12:00:00Z`), label })),
    });
    for (const { text, sources } of issue.claims) {
      await db.claim.create({ data: { issueId: row.id, text, kind: "REGISTO_OFICIAL", sources: connect(sources, ids) } });
    }
  }
}

async function seedPublicData(ids: Map<string, string>) {
  const dataFile = path.join(__dirname, "data", "base-contratos-2026.json");
  const summary = await importBaseContracts(db, "base-contratos-2026.json", readFileSync(dataFile, "utf8"), RETRIEVED_AT);
  console.log(`Contratos: ${summary.imported} importados.`);

  await db.budgetEntry.deleteMany({ where: { year: 2026 } });
  for (const { source, amount, asOf, ...entry } of BUDGET) {
    await db.budgetEntry.create({
      data: {
        ...entry,
        amountEur: amount,
        asOf: asOf ? new Date(`${asOf}T12:00:00Z`) : null,
        updatedAt: RETRIEVED_AT,
        sources: connect([source], ids),
      },
    });
  }
  for (const { date, amount, source } of CASH_HISTORY) {
    await db.budgetEntry.create({
      data: {
        year: Number(date.slice(0, 4)),
        kind: "SITUACAO_FINANCEIRA",
        label: "Histórico de disponibilidades",
        amountEur: amount,
        asOf: new Date(`${date}T12:00:00Z`),
        updatedAt: RETRIEVED_AT,
        sources: connect([source], ids),
      },
    });
  }
}

async function main() {
  const ids = await seedSources();
  await seedOfficials(ids);
  await seedRecord(ids);
  await seedIssues(ids);
  await seedPublicData(ids);
  console.log("Seed concluído.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
