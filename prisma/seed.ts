import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { DEFAULT_OPTIONS } from "../src/lib/categories";
import { importBaseContracts } from "../src/lib/import/run";
import { slugify } from "../src/lib/import/records";
import { isOfficialUrl } from "../src/lib/sources";
import {
  ASSEMBLY_BOARD,
  ASSEMBLY_DEPUTIES,
  COMMITTEES,
  DECISIONS,
  EXECUTIVE,
  FINANCIAL_FACTS,
  ISSUES,
  MEETINGS,
  PARISH_PRESIDENTS,
  RETRIEVED_AT,
  SOURCES,
} from "./data/real";

const db = new PrismaClient();

const connect = (keys: string[], ids: Map<string, string>) => ({
  connect: keys.map((key) => {
    const id = ids.get(key);
    if (!id) throw new Error(`Fonte desconhecida: ${key}`);
    return { id };
  }),
});

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
    const fields = { ...person, slug: slugify(person.name), sources: connect([source], ids) };
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
    const fields = { ...meeting, date: new Date(date), sources: connect(sources, ids) };
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
        sources: connect([group.source, ...extra], ids),
      };
      await db.decision.upsert({ where: { slug }, update: fields, create: { ...fields, slug } });
    }
  }

  // Única contagem nominal encontrada: Ata n.º 1/2026.
  const climate = await db.decision.findFirstOrThrow({ where: { title: { contains: "alterações climáticas" } } });
  await db.decision.update({ where: { id: climate.id }, data: { votesFor: 41, votesAgainst: 0, abstentions: 1 } });
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
    const existing = await db.issue.findUnique({ where: { slug: issue.slug } });
    if (existing) continue;
    await db.issue.create({
      data: {
        slug: issue.slug,
        title: issue.title,
        category: issue.category,
        summary: issue.summary,
        stage: issue.stage,
        status: "ATIVO",
        options: { create: (issue.options ?? DEFAULT_OPTIONS).map((label, order) => ({ label, order })) },
        dates: { create: issue.dates.map(({ date, label }) => ({ date: new Date(`${date}T12:00:00Z`), label })) },
        decisions: { connect: decisions },
        sources: connect(issue.sources, ids),
        claims: { create: issue.claims.map(({ text, sources }) => ({ text, kind: "REGISTO_OFICIAL" as const, sources: connect(sources, ids) })) },
      },
    });
  }
}

async function seedPublicData(ids: Map<string, string>) {
  const dataFile = path.join(__dirname, "data", "base-contratos-2026.json");
  const summary = await importBaseContracts(db, "base-contratos-2026.json", readFileSync(dataFile, "utf8"), RETRIEVED_AT);
  console.log(`Contratos: ${summary.imported} importados.`);

  await db.budgetEntry.deleteMany({ where: { kind: "SITUACAO_FINANCEIRA", isExample: false } });
  for (const fact of FINANCIAL_FACTS) {
    await db.budgetEntry.create({
      data: {
        year: 2026,
        kind: "SITUACAO_FINANCEIRA",
        label: fact.label,
        amountEur: fact.amount,
        asOf: new Date("2026-06-19T12:00:00Z"),
        note: fact.note,
        sources: connect(["am-info-2406"], ids),
      },
    });
  }
}

/** Dados fictícios e assinalados, para ver a interface antes de haver participação real. */
async function seedExamples() {
  await db.issue.deleteMany({ where: { isExample: true } });
  await db.claim.deleteMany({ where: { isExample: true } });
  await db.budgetEntry.deleteMany({ where: { isExample: true } });
  await db.topicProposal.deleteMany({ where: { title: { startsWith: "[EXEMPLO]" } } });

  const example = (
    slug: string,
    title: string,
    category: string,
    summary: string,
    counts: [string, number][],
    claim: string,
  ) =>
    db.issue.create({
      data: {
        slug,
        title: `[EXEMPLO] ${title}`,
        category,
        summary,
        stage: "Dados fictícios de demonstração",
        status: "ATIVO",
        isExample: true,
        options: { create: counts.map(([label, exampleCount], order) => ({ label, exampleCount, order })) },
        claims: { create: { text: claim, kind: "CONTEXTO_EDITORIAL", isExample: true } },
      },
    });

  await example(
    "exemplo-ciclovia",
    "Ciclovia entre o centro e a estação",
    "Mobilidade e transportes",
    "Tema fictício, criado apenas para demonstrar como aparecem os resultados agregados. Não corresponde a nenhuma proposta real.",
    [["Concordo", 148], ["Discordo", 61], ["Preciso de mais informação", 39]],
    "Afirmação fictícia sem fonte: serve para demonstrar o estado “Não verificado”.",
  );
  await example(
    "exemplo-licenciamento",
    "Prazos de licenciamento urbanístico",
    "Urbanismo e licenciamento",
    "Tema fictício, com poucas respostas, para demonstrar que abaixo do mínimo não se publicam contagens.",
    [["Concordo", 2], ["Discordo", 1], ["Preciso de mais informação", 1]],
    "Afirmação fictícia sem fonte, de demonstração.",
  );

  for (const [kind, label, amountEur] of [
    ["DESPESA", "[EXEMPLO] Pessoal", 30000000],
    ["DESPESA", "[EXEMPLO] Aquisição de bens e serviços", 26000000],
    ["DESPESA", "[EXEMPLO] Investimento", 21000000],
    ["RECEITA", "[EXEMPLO] Impostos diretos", 34000000],
    ["RECEITA", "[EXEMPLO] Transferências correntes", 28000000],
  ] as const) {
    await db.budgetEntry.create({
      data: { year: 2026, kind, label, amountEur, isExample: true, note: "Valor fictício, de demonstração." },
    });
  }

  await db.topicProposal.create({
    data: {
      title: "[EXEMPLO] Mais bancos e sombra nos jardins públicos",
      description: "Proposta fictícia, para demonstrar a recolha de apoios.",
      category: "Segurança e espaço público",
      status: "A_RECOLHER_APOIOS",
    },
  });
}

async function main() {
  await db.appSetting.upsert({ where: { key: "proposal_threshold" }, update: {}, create: { key: "proposal_threshold", value: "25" } });
  await db.appSetting.upsert({ where: { key: "min_public_count" }, update: {}, create: { key: "min_public_count", value: "10" } });

  const ids = await seedSources();
  await seedOfficials(ids);
  await seedRecord(ids);
  await seedIssues(ids);
  await seedPublicData(ids);

  const wantsExamples = process.env.SEED_EXAMPLES
    ? process.env.SEED_EXAMPLES === "true"
    : process.env.NODE_ENV !== "production";
  if (wantsExamples) await seedExamples();

  console.log(`Seed concluído${wantsExamples ? " (com dados de exemplo assinalados)" : ""}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
