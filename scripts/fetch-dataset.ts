// Descarrega um ficheiro público para data/raw, respeitando o robots.txt do domínio.
// Uso: npm run fetch:dataset -- <url> <nome-do-ficheiro>

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { politeFetch } from "../src/lib/robots";

async function main() {
  const [url, name] = process.argv.slice(2);
  if (!url || !name) throw new Error("Uso: npm run fetch:dataset -- <url> <nome-do-ficheiro>");
  const directory = path.join(process.cwd(), "data", "raw");
  mkdirSync(directory, { recursive: true });
  const response = await politeFetch(url);
  const target = path.join(directory, path.basename(name));
  writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  console.log(`Guardado em ${target}. Anote a data de hoje: é a data de recolha da fonte.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
