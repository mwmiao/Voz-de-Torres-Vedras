# Plan 001: Make the ingestion HTTP cache survive a corrupt or interrupted write

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2b25824..HEAD -- ingestion/fetchers/http.ts tests/ingestion.test.ts`
> If either file changed, compare the "Current state" excerpts against the live code; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `2b25824`, 2026-11-13

## Why this matters

`PoliteHttp` keeps a conditional-request cache in `data/cache/http.json`. The constructor parses it with a bare `JSON.parse`, and `saveCache` overwrites it in place. If a run is killed mid-write (container stop, CI cancel), the file is truncated, and every later ingestion run throws in the constructor before fetching anything. The file is git-ignored cache, so deleting it is always safe — the code should recover by itself instead of crashing.

## Current state

- `ingestion/fetchers/http.ts` — the only file with the cache logic. Constructor and `saveCache` (lines ~36-52):

```ts
  constructor(
    private readonly delayMs = Number(process.env.INGEST_DELAY_MS ?? 1500),
    private readonly fetcher: typeof fetch = fetch,
    cacheDir = path.join(process.cwd(), "data", "cache"),
  ) {
    mkdirSync(cacheDir, { recursive: true });
    this.cacheFile = path.join(cacheDir, "http.json");
    this.cache = existsSync(this.cacheFile) ? JSON.parse(readFileSync(this.cacheFile, "utf8")) : {};
  }

  saveCache() {
    writeFileSync(this.cacheFile, JSON.stringify(this.cache));
  }
```

- The file already imports `mkdirSync, existsSync, readFileSync, writeFileSync` from `node:fs` and `path`; add `renameSync` to that import.
- Conventions: code comments and error strings are in European Portuguese; tests use vitest (`tests/*.test.ts`, `import { describe, expect, it } from "vitest"`). `PoliteHttp` takes `cacheDir` as its third constructor argument, so tests can pass a temp dir (see `mkdtempSync(path.join(tmpdir(), "voz-db-"))` at the top of `tests/updaters.test.ts`).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| All tests | `npm test` | all pass (173 before this plan) |
| One file | `npx vitest run tests/ingestion.test.ts` | pass |

## Scope

**In scope**: `ingestion/fetchers/http.ts`; `tests/ingestion.test.ts` (add tests; if a separate file is cleaner, create `tests/http-cache.test.ts`).
**Out of scope**: retry/robots logic in `request`; any other file; the cache entry shape.

## Git workflow

- Branch `advisor/001-http-cache`. Commit messages are short imperative English (e.g. "Fix missing incidents on the Segurança map"). Do NOT push or open a PR.

## Steps

### Step 1: Failing tests first
Add tests (temp dir as `cacheDir`, a stub `fetcher`, `delayMs` 0):
1. `http.json` contains `{"truncated":` → `new PoliteHttp(0, stub, dir)` does not throw and the cache starts empty.
2. `http.json` contains valid JSON that is not an object (`[]` or `"x"`) → also treated as empty.
3. After `saveCache()`, `http.json` parses as the saved object and no `http.json.tmp` is left in the directory.

**Verify**: `npx vitest run tests/ingestion.test.ts` → tests 1 and 2 FAIL (constructor throws), confirming they exercise the bug.

### Step 2: Guard the load
Replace the constructor's last line with a private helper `loadCache(file)`: return `{}` if the file is missing; otherwise `try { parsed = JSON.parse(readFileSync(file, "utf8")) } catch { return {} }`; return `parsed` only if it is a non-null, non-array object, else `{}`. Add the Portuguese comment: «Uma cache corrompida só custa pedidos novos: recomeça vazia.»

### Step 3: Atomic save
`saveCache` writes to `` `${this.cacheFile}.tmp` `` and then `renameSync`s it to `this.cacheFile`.

**Verify**: `npx vitest run tests/ingestion.test.ts` → all pass including the 3 new tests; `npm run typecheck && npm run lint` → exit 0.

## Test plan
The three tests above, modelled on the temp-dir pattern in `tests/updaters.test.ts`. No network.

## Done criteria
- [ ] `npm run typecheck`, `npm run lint`, `npm test` exit 0; at least 176 tests pass
- [ ] `grep -n "JSON.parse(readFileSync" ingestion/fetchers/http.ts` matches only inside `loadCache`'s try block
- [ ] `git status` shows only in-scope files changed
- [ ] `plans/README.md` row updated

## STOP conditions
- The constructor or `saveCache` code does not match the excerpt.
- `renameSync` over an existing file fails on Windows in the test (report the error; do not silently switch strategy).
- The fix appears to require touching `request()` or any out-of-scope file.

## Maintenance notes
If the cache ever holds more than hashes/etags (for example bodies), revisit size limits. Reviewer: confirm a corrupt cache silently resets (acceptable — it is only a conditional-request optimisation).
