// Uso:
//   npm run import -- base data/raw/Contratos2026.json
//   npm run import -- decisoes data/decisoes.csv https://www.am-tvedras.pt/sessoes/editais/
//   npm run import -- orcamento data/orcamento.csv https://www.cm-tvedras.pt/documentos/gestao/

import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { importBaseContracts, importBudget, importDecisions } from "../src/lib/import/run";

async function main() {
  const [kind, file, sourceUrl] = process.argv.slice(2);
  if (!kind || !file) throw new Error("Uso: npm run import -- <base|decisoes|orcamento> <ficheiro> [url da fonte]");

  const db = new PrismaClient();
  try {
    const name = path.basename(file);
    const content = readFileSync(file, "utf8");
    if (kind === "base") {
      console.log(await importBaseContracts(db, name, content));
    } else if (kind === "decisoes" || kind === "orcamento") {
      if (!sourceUrl) throw new Error("Indique o URL de onde vieram os dados.");
      const run = kind === "decisoes" ? importDecisions : importBudget;
      console.log(await run(db, name, content, sourceUrl));
    } else {
      throw new Error(`Conjunto desconhecido: ${kind}`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
