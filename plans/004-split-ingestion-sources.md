# Plan 004: Split `ingestion/sources/index.ts` into per-domain modules without behaviour change

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. On any STOP condition, stop and report — do not improvise. This is a pure move-and-rename refactor: do not change any logic. When done, update this plan's row in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2b25824..HEAD -- ingestion/sources tests ingestion/run.ts src/lib/source-tiers.ts`
> If `ingestion/sources/index.ts` changed, re-map the function list below against the live file; on a mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW (mechanical, 173 tests guard the collectors; but import cycles are possible)
- **Depends on**: none (Plan 001 touches a different file; they can run in either order)
- **Category**: tech-debt
- **Planned at**: commit `2b25824`, 2026-11-13

## Why this matters

`ingestion/sources/index.ts` is 656 lines mixing municipal documents, contracts, finance, weather/civil-protection alerts, INE crime statistics and the incident (news/social) collectors. It is the biggest file in the repo and every source change touches it. Splitting by domain makes each collector family reviewable on its own and removes the unrelated imports (it currently imports ~40 symbols from a dozen parsers). It also exposes one real gap while moving: INE collection swallows the *population* fetch error silently (`.catch(() => null)`), which should at least be commented or surfaced.

## Current state

`ingestion/sources/index.ts` (656 lines) top-level layout (line numbers approximate):

- 59-67: `CollectorInput`, `Collector` types, constants `SINCE`, `CM`, `slugBase`
- 69: `page()` helper (change-detected page fetch)
- 75-262: municipal/Assembleia/Câmara/contracts collectors: `collectAmDocumentos`, `collectAmEditais`, `collectFinance`, `collectAmComposicao`, `collectBaseYearly`, `collectContratos`, `parseRevisions`, `collectAnuncios`, `collectModificacoes`, `collectCmEditais`, `collectCmAtas`, `simple`, `collectCmComposicao`
- 268-297: INE crime: `ineData`, `collectIneCrime` (contains the `.catch(() => null)` on the population series at ~line 289)
- 298-339: alerts: `collectIpma`, `collectCmAvisos`, `collectCmProciv`, `collectSmas`
- 340-361: `collectCurated`
- 362-575: incident collectors: `recent`, `ArticleStub`, `ArticleAdapter`, `articleCollector`, `collectGnr`, `collectNoticiasAoMinuto`, `newsFeedCollector` (exported), `readCommunityConfig`, `socialStub`, `collectMastodon`, `collectTelegram`
- 576-625: `curatedPlace`, `collectCuratedIncidents`
- 626-656: `export const COLLECTORS: Record<string, Collector>` and `export { StructureError }`.

Importers of this module (must keep working unchanged):
- `ingestion/run.ts:15` — `import { COLLECTORS } from "./sources";`
- `tests/ingestion.test.ts:14` — `import { COLLECTORS } from "../ingestion/sources";`
- `tests/news-sources.test.ts:9` and `tests/incident-regressions.test.ts:7` — `import { newsFeedCollector, type CollectorInput } from "../ingestion/sources";` (the first also imports `COLLECTORS`)
- `src/lib/source-tiers.ts:2` imports `isOfficialUrl, isSocialMediaUrl` from `./sources` — that is `src/lib/sources.ts`, a DIFFERENT module; do not touch it.

Conventions: TypeScript ESM, path alias `@/` → `src/`, relative imports inside `ingestion/`, comments in European Portuguese, no default exports. Match this.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Tests | `npm test` | 173+ pass |
| Line count | `wc -l ingestion/sources/*.ts` | `index.ts` under ~120 lines |

## Scope

**In scope**: `ingestion/sources/index.ts` (shrinks to a barrel + `COLLECTORS` map); new files `ingestion/sources/types.ts`, `ingestion/sources/camara.ts` (municipal docs/contracts/finance), `ingestion/sources/ine.ts`, `ingestion/sources/alertas.ts`, `ingestion/sources/incidentes.ts` (article/social/curated incident collectors).
**Out of scope**: all parsers (`ingestion/parsers/**`), `ingestion/run.ts`, `src/**`, tests (no edits except none expected), any logic change, any rename of exported symbols.

## Git workflow
Branch `advisor/004-split-sources`. One commit per extracted module ("Extract INE collector from sources index"). Do NOT push or open a PR.

## Steps

### Step 0: Baseline
Run `npm test` and record the pass count; run `npm run typecheck`. Both must be green before you start.

### Step 1: Shared types
Create `ingestion/sources/types.ts` exporting `CollectorInput` and `Collector` (moved verbatim, plus `import type` lines they need). In `index.ts`, `import type`/re-export them: `export type { CollectorInput, Collector } from "./types";`.
**Verify**: `npm run typecheck` → exit 0.

### Step 2: Extract one module at a time (INE, alerts, camara, incidentes — in that order)
For each: cut the contiguous block listed above into the new file; move only the imports that block uses; export each collector (and any helper another module needs, e.g. `page`, `CM`, `SINCE`, `recent`) with `export`; import them back into `index.ts` for the `COLLECTORS` map. If two new modules need the same helper (`page`, `CM`), move it to `types.ts`-neighbour `ingestion/sources/shared.ts` rather than importing between sibling modules (avoids cycles).
In `ine.ts`, above the population `.catch(() => null)` add the comment «A estimativa de população é opcional: sem ela, o ano fica sem taxa por habitante.» **Do not change the behaviour.**
`newsFeedCollector` must stay exported from `index.ts` (re-export from `incidentes.ts`) and so must `StructureError`.
**Verify after each module**: `npm run typecheck && npx vitest run` → exit 0 and the Step 0 pass count.

### Step 3: Clean up `index.ts`
`index.ts` keeps: re-exports (`CollectorInput`, `Collector`, `newsFeedCollector`, `StructureError`) and the `COLLECTORS` record. Remove unused imports (`npm run lint` reports them).
**Verify**: `wc -l ingestion/sources/index.ts` → under 150; `npm run lint` → exit 0.

### Step 4: Golden check
Run `npx tsx -e "import('./ingestion/sources/index.ts').then(m => console.log(Object.keys(m.COLLECTORS).sort().join(',')))"` before Step 1 (save output) and after Step 3; the two outputs must be identical.
**Verify**: outputs identical.

## Test plan
No new tests: this is a behaviour-preserving move, and `tests/ingestion.test.ts`, `tests/news-sources.test.ts`, `tests/incident-regressions.test.ts` exercise `COLLECTORS` and `newsFeedCollector`. The golden check in Step 4 proves the registry is unchanged.

## Done criteria
- [ ] `npm run typecheck`, `npm run lint`, `npm test` exit 0; same test count as Step 0
- [ ] `wc -l ingestion/sources/index.ts` < 150
- [ ] `git diff --stat 2b25824..HEAD -- ingestion/parsers tests src ingestion/run.ts` is empty
- [ ] Golden collector-key list identical before and after
- [ ] `plans/README.md` row updated

## STOP conditions
- The file layout does not match "Current state".
- A circular import appears (runtime `undefined` collector or a TS error about import cycles) that `shared.ts` does not resolve.
- Any test fails after a move and the cause is not an obvious missing import/export.
- You feel the need to change logic, rename a symbol, or edit a parser or test.

## Maintenance notes
New source families should get their own file under `ingestion/sources/` and one line in `COLLECTORS`. Reviewer: diff each new file against the original blocks (`git diff --color-moved=dimmed-zebra`) to confirm moved code is byte-identical except imports/exports. Deferred: making the INE population failure visible in the source status (needs a decision on whether an optional series failure should mark the run degraded).
