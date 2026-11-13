// Prepares a fresh e2e database and starts the production server on port 1401.
// Requires `npm run build` to have run first.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dbFile = path.join(root, "data", "e2e.db");
for (const suffix of ["", "-wal", "-shm", "-journal"]) {
  if (existsSync(dbFile + suffix)) rmSync(dbFile + suffix);
}
const env = { ...process.env, DATABASE_URL: `file:${dbFile.replaceAll("\\", "/")}` };

function run(args) {
  const result = spawnSync("npx", args, { cwd: root, env, stdio: "inherit", shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["prisma", "migrate", "deploy"]);
run(["tsx", "e2e/seed.ts"]);

const server = spawn("npm", ["run", "start", "--", "-p", "1401"], { cwd: root, env, stdio: "inherit", shell: true });
server.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill());
