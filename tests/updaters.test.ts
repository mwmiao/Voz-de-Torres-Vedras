import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { exportSnapshot, loadSnapshot } from "../ingestion/snapshot";
import type { ContractRecord, DocumentRecord } from "../ingestion/types";
import { applyRecord, retireMissingOfficials, type ApplyContext } from "../ingestion/updaters/apply";

const directory = mkdtempSync(path.join(tmpdir(), "voz-db-"));

function database(name: string): PrismaClient {
  const url = `file:${path.join(directory, name).replaceAll("\\", "/")}`;
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
  return new PrismaClient({ datasourceUrl: url });
}

const db = database("teste.db");
const context = (overrides: Partial<ApplyContext> = {}): ApplyContext => ({
  db,
  sourceId: "teste",
  runId: "execucao-teste",
  now: new Date("2026-11-01T12:00:00Z"),
  baseline: false,
  ...overrides,
});

const document: DocumentRecord = {
  kind: "document",
  url: "https://www.am-tvedras.pt/edital.pdf",
  title: "Edital n.º 1/2026",
  publisher: "Assembleia Municipal",
  docType: "EDITAL",
  category: "REUNIAO",
  publishedAt: new Date("2026-10-30T12:00:00Z"),
};

const contract: ContractRecord = {
  kind: "contract",
  baseId: "100",
  title: "Obra",
  awardingBody: "Município de Torres Vedras",
  awardingNif: "502173653",
  supplierName: "Empresa, Lda",
  supplierNif: "500000000",
  supplierIsPerson: false,
  procedureType: "Concurso público",
  contractType: null,
  cpvCode: null,
  cpvLabel: null,
  priceEur: 1000.5,
  signedAt: new Date("2026-10-01T12:00:00Z"),
  publishedAt: new Date("2026-10-02T12:00:00Z"),
  durationDays: 30,
  sourceUrl: "https://www.base.gov.pt/Base4/pt/detalhe/?type=contratos&id=100",
};

const clean = async () => {
  await db.updateEvent.deleteMany();
  await db.contract.deleteMany();
  await db.source.deleteMany();
  await db.official.deleteMany();
  await db.importRun.deleteMany();
  await db.importRun.create({
    data: { id: "execucao-teste", dataset: "teste", sourceUrl: "https://x", fileName: "-", sha256: "-", retrievedAt: new Date() },
  });
};

describe("atualização de registos", () => {
  beforeAll(clean);
  afterAll(() => db.$disconnect());

  it("distingue novo, inalterado e atualizado, e guarda o valor anterior", async () => {
    await clean();
    expect(await applyRecord(context(), document)).toBe("NEW");
    expect(await applyRecord(context(), document)).toBe("UNCHANGED");
    expect(await applyRecord(context(), { ...document, title: "Edital n.º 1/2026 (retificado)" })).toBe("UPDATED");

    const event = await db.updateEvent.findFirstOrThrow({ where: { status: "UPDATED" }, include: { changes: true } });
    expect(event.sourceUrl).toBe(document.url);
    expect(event.changes).toEqual([
      expect.objectContaining({ field: "title", oldValue: "Edital n.º 1/2026", newValue: "Edital n.º 1/2026 (retificado)" }),
    ]);
  });

  it("não duplica um registo com a mesma chave natural", async () => {
    await clean();
    await applyRecord(context(), document);
    await applyRecord(context(), document);
    expect(await db.source.count({ where: { url: document.url } })).toBe(1);
  });

  it("marca como não verificado o que não vem de um domínio oficial", async () => {
    await clean();
    await applyRecord(context(), { ...document, url: "http://cmtvdata.info/a.pdf" });
    expect((await db.source.findFirstOrThrow()).official).toBe(false);
  });

  it("não substitui o título de uma fonte transcrita à mão", async () => {
    await clean();
    await db.source.create({ data: { name: "AM", title: "Título revisto", url: document.url, type: "EDITAL", retrievedAt: new Date() } });
    expect(await applyRecord(context(), document)).toBe("UNCHANGED");
    const source = await db.source.findFirstOrThrow();
    expect(source.title).toBe("Título revisto");
    expect(source.url).toBe(document.url);
    expect(source.contentHash).toBeTruthy();
  });

  it("regista a alteração do preço de um contrato", async () => {
    await clean();
    expect(await applyRecord(context(), contract)).toBe("NEW");
    expect(await applyRecord(context(), contract)).toBe("UNCHANGED");
    expect(await applyRecord(context(), { ...contract, priceEur: 2000 })).toBe("UPDATED");
    const change = await db.fieldChange.findFirstOrThrow({ where: { field: "priceEur" } });
    expect([change.oldValue, change.newValue]).toEqual(["1000.5", "2000"]);
    expect(Number((await db.contract.findFirstOrThrow()).priceEur)).toBe(2000);
  });

  it("na primeira execução, só o recente aparece como novidade", async () => {
    await clean();
    const baseline = context({ baseline: true });
    await applyRecord(baseline, document);
    await applyRecord(baseline, { ...document, url: "https://www.am-tvedras.pt/antigo.pdf", publishedAt: new Date("2020-01-01T12:00:00Z") });
    expect(await db.source.count()).toBe(2);
    expect((await db.updateEvent.findMany()).map((event) => event.entityKey)).toEqual([document.url]);
  });

  it("assinala eleitos que deixam de constar da composição, sem os apagar", async () => {
    await clean();
    await db.official.create({ data: { slug: "ana-exemplo", name: "Ana Exemplo", role: "Vereadora", body: "EXECUTIVO_MUNICIPAL" } });
    await db.official.create({ data: { slug: "rui-exemplo", name: "Rui Exemplo", role: "Vereador", body: "EXECUTIVO_MUNICIPAL" } });
    expect(await retireMissingOfficials(context(), ["Ana Exemplo"], "https://www.cm-tvedras.pt/o/composicaocm")).toBe(1);
    expect((await db.official.findUniqueOrThrow({ where: { slug: "rui-exemplo" } })).active).toBe(false);
    expect((await db.official.findUniqueOrThrow({ where: { slug: "ana-exemplo" } })).active).toBe(true);
  });
});

describe("cópia de dados", () => {
  it("exporta e volta a carregar os dados sem perdas", async () => {
    await clean();
    await applyRecord(context(), { ...document, data: { numero: "1/2026", lista: ["a"] } });
    await applyRecord(context(), contract);
    await applyRecord(context(), { ...contract, priceEur: 2000.25 });
    await db.official.create({ data: { slug: "ana", name: "Ana Exemplo", role: "Vereadora", body: "EXECUTIVO_MUNICIPAL", portfolios: ["Educação"] } });

    const snapshot = path.join(directory, "snapshot");
    expect(await exportSnapshot(db, snapshot)).toBeGreaterThan(3);

    const copy = database("copia.db");
    await loadSnapshot(copy, snapshot);
    const restored = await copy.contract.findFirstOrThrow({ include: { sources: true } });
    expect(Number(restored.priceEur)).toBe(2000.25);
    expect(restored.signedAt?.toISOString()).toBe(contract.signedAt?.toISOString());
    // As comparações em SQL dependem de a data não ficar guardada como texto.
    expect(await copy.contract.count({ where: { signedAt: { gte: new Date("2026-01-01T00:00:00Z") } } })).toBe(1);
    expect(restored.sources).toHaveLength(1);
    expect(await copy.fieldChange.count()).toBe(1);
    expect((await copy.official.findFirstOrThrow()).portfolios).toEqual(["Educação"]);
    expect((await copy.source.findUniqueOrThrow({ where: { url: document.url } })).data).toEqual({ numero: "1/2026", lista: ["a"] });
    await copy.$disconnect();
  }, 30_000);
});
