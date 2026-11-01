// Uso: npx tsx scripts/data.ts <bootstrap|export|load|backup|validate>

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { deriveAll } from "../ingestion/derive";
import { exportSnapshot, loadSnapshot, normalizeDates } from "../ingestion/snapshot";

const SNAPSHOT = process.env.SNAPSHOT_DIR ?? path.join(process.cwd(), "data", "snapshot");

async function isEmpty(db: PrismaClient) {
  return (await db.meeting.count()) === 0 && (await db.source.count()) === 0;
}

/** Numa base de dados vazia, carrega a cópia publicada ou, se não existir, o seed. */
async function bootstrap(db: PrismaClient) {
  if (!(await isEmpty(db))) {
    console.log("Base de dados já preenchida.");
    const fixed = await normalizeDates(db);
    if (fixed > 0) console.log(`Datas corrigidas: ${fixed}.`);
    await deriveAll(db);
    return;
  }
  // Uma cópia que existe e não carrega é um erro: o seed esconderia a perda dos dados recolhidos.
  if (existsSync(SNAPSHOT)) {
    console.log(`Cópia carregada: ${await loadSnapshot(db, SNAPSHOT)} registos.`);
    await deriveAll(db);
    return;
  }
  console.log("Sem cópia de dados. A correr o seed.");
  const result = spawnSync("npx prisma db seed", { stdio: "inherit", shell: true });
  if (result.status !== 0) throw new Error("O seed falhou.");
  await deriveAll(db);
}

async function backup(db: PrismaClient) {
  const directory = path.join(process.cwd(), "data", "backups");
  mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const target = path.join(directory, `voz-torres-vedras-${stamp}.db`);
  await db.$executeRawUnsafe(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  console.log(`Cópia de segurança: ${target}`);
}

/** Verificações antes de publicar dados. */
async function validate(db: PrismaClient) {
  const problems: string[] = [];
  const unsourcedDecisions = await db.decision.count({ where: { sources: { none: { official: true } } } });
  if (unsourcedDecisions > 0) problems.push(`${unsourcedDecisions} decisões sem fonte oficial`);
  const unsourcedContracts = await db.contract.count({ where: { sources: { none: { official: true } } } });
  if (unsourcedContracts > 0) problems.push(`${unsourcedContracts} contratos sem fonte oficial`);
  const unsourcedEntries = await db.budgetEntry.count({ where: { sources: { none: { official: true } } } });
  if (unsourcedEntries > 0) problems.push(`${unsourcedEntries} valores orçamentais sem fonte oficial`);
  const badEvents = await db.updateEvent.count({ where: { sourceUrl: "" } });
  if (badEvents > 0) problems.push(`${badEvents} atualizações sem ligação à fonte`);
  const orphans = await db.$queryRawUnsafe<unknown[]>("PRAGMA foreign_key_check");
  if (orphans.length > 0) problems.push(`${orphans.length} referências inválidas`);
  const integrity = await db.$queryRawUnsafe<{ integrity_check: string }[]>("PRAGMA integrity_check");
  if (integrity[0]?.integrity_check !== "ok") problems.push("ficheiro SQLite com erros de integridade");
  if ((await db.contract.count()) === 0) problems.push("sem contratos");
  const unsourcedAlerts = await db.alert.count({ where: { sourceUrl: "" } });
  if (unsourcedAlerts > 0) problems.push(`${unsourcedAlerts} alertas sem ligação à fonte`);
  const unsourcedSummaries = await db.summary.count({ where: { sourceUrl: "" } });
  if (unsourcedSummaries > 0) problems.push(`${unsourcedSummaries} resumos sem ligação à fonte`);
  if ((await db.official.count({ where: { active: true } })) < 7) problems.push("menos de 7 eleitos ativos");

  if (problems.length > 0) {
    console.error(`Validação falhou:\n- ${problems.join("\n- ")}`);
    process.exitCode = 1;
  } else {
    console.log("Validação concluída sem problemas.");
  }
}

async function main() {
  const command = process.argv[2];
  const db = new PrismaClient();
  try {
    if (command === "bootstrap") await bootstrap(db);
    else if (command === "export") console.log(`Cópia exportada: ${await exportSnapshot(db, SNAPSHOT)} registos.`);
    else if (command === "load") console.log(`Cópia carregada: ${await loadSnapshot(db, SNAPSHOT)} registos.`);
    else if (command === "backup") await backup(db);
    else if (command === "validate") await validate(db);
    else throw new Error("Uso: npx tsx scripts/data.ts <bootstrap|export|load|backup|validate>");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
