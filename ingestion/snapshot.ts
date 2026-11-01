import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

type Row = Record<string, unknown>;

async function tables(db: PrismaClient): Promise<string[]> {
  const rows = await db.$queryRawUnsafe<{ name: string }[]>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY name`,
  );
  return rows.map((row) => row.name);
}

function serialize(row: Row): string {
  return JSON.stringify(row, (_key, value) => {
    if (typeof value === "bigint") return Number(value);
    if (value && typeof value === "object" && "toFixed" in value) return Number(value);
    return value;
  });
}

/** Escreve cada tabela num ficheiro, com um registo por linha, para que as alterações sejam legíveis. */
export async function exportSnapshot(db: PrismaClient, directory: string): Promise<number> {
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  let total = 0;
  for (const table of await tables(db)) {
    const rows = await db.$queryRawUnsafe<Row[]>(`SELECT * FROM "${table}" ORDER BY 1, 2`);
    writeFileSync(path.join(directory, `${table}.jsonl`), rows.map(serialize).join("\n") + (rows.length ? "\n" : ""));
    total += rows.length;
  }
  return total;
}

/**
 * O Prisma guarda datas como milissegundos, mas a exportação escreve-as como texto ISO. Em texto,
 * as datas leem-se bem, porém todas as comparações em SQL falham: «a partir de hoje» não encontra nada.
 */
export async function normalizeDates(db: PrismaClient): Promise<number> {
  let fixed = 0;
  for (const table of await tables(db)) {
    const columns = await db.$queryRawUnsafe<{ name: string; type: string }[]>(`PRAGMA table_info("${table}")`);
    for (const { name } of columns.filter((column) => column.type === "DATETIME")) {
      fixed += await db.$executeRawUnsafe(
        `UPDATE "${table}" SET "${name}" = CAST(strftime('%s', "${name}") AS INTEGER) * 1000 + CAST(substr(strftime('%f', "${name}"), 4) AS INTEGER) WHERE typeof("${name}") = 'text'`,
      );
    }
  }
  return fixed;
}

/** Carrega uma cópia para uma base de dados vazia. */
export async function loadSnapshot(db: PrismaClient, directory: string): Promise<number> {
  if (!existsSync(directory)) throw new Error(`Cópia de dados não encontrada: ${directory}`);
  const known = new Set(await tables(db));
  let total = 0;
  const statements: { sql: string; values: unknown[] }[] = [];
  for (const file of readdirSync(directory).filter((name) => name.endsWith(".jsonl"))) {
    const table = file.replace(/\.jsonl$/, "");
    if (!known.has(table)) continue;
    const lines = readFileSync(path.join(directory, file), "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      const row = JSON.parse(line) as Row;
      const columns = Object.keys(row);
      statements.push({
        sql: `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
        // As colunas JSON chegam já interpretadas e são guardadas como texto.
        values: columns.map((column) => {
          const value = row[column];
          return value !== null && typeof value === "object" ? JSON.stringify(value) : value;
        }),
      });
      total += 1;
    }
  }
  await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("PRAGMA defer_foreign_keys = ON");
      for (const { sql, values } of statements) await tx.$executeRawUnsafe(sql, ...values);
    },
    { timeout: 300_000 },
  );
  await normalizeDates(db);
  return total;
}
