# Plan 002: Add a browser smoke test for the Segurança incident map and run it in CI

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. On any STOP condition, stop and report. When done, update this plan's row in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2b25824..HEAD -- src/components package.json .github/workflows/ci.yml prisma/schema.prisma`
> If changed, compare against "Current state"; on a mismatch affecting this plan, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `2b25824`, 2026-11-13

## Why this matters

The Segurança page's map (Leaflet, loaded with `next/dynamic` `ssr: false`), popups and filters are client-only code. The 173 vitest tests run in Node and cannot catch hydration or popup breakage; CI only `curl`s pages for static text. A recent restructure (IncidentExplorer split, React popups inside Leaflet) was committed with a suspected "page does not hydrate" bug that took manual browser work to disprove. One browser smoke test with one seeded incident gives a fast, objective signal for this whole class of regressions, and is the prerequisite for Plan 003 (CSP).

## Current state

- `src/app/seguranca/page.tsx` → `src/components/IncidentSection.tsx` (server) → `src/components/IncidentExplorer.tsx` (`"use client"`; `dynamic(() => import("./IncidentMap"), { ssr: false, loading: () => <MapMessage>A carregar o mapa…</MapMessage> })`).
- `src/components/IncidentMap.tsx` — Leaflet map; markers are `.leaflet-marker-icon`; clicking one opens a popup rendered by React through `createPortal`, containing `.incident-popup` (`src/components/IncidentPopup.tsx`) with a `button.incident-popup__list` labelled "Ver na lista" and a link "Ver fonte original".
- The page streams: first paint shows "A carregar os dados..." and later the real content. Wait for `.leaflet-container`.
- Only incidents with `incidentStart` in the last 14 days (Lisbon day), `archivedAt = null`, `heldForReview = false` appear (`src/lib/incidents.ts`: `publicIncidentWhere`, `visibilityProblem`). The real dev database currently has no visible incidents, so the test needs its own seeded DB.
- Prisma model `Incident` (`prisma/schema.prisma:733`) has many required fields: `key` (unique), `category`, `summary`, `sourceName`, `sourceTier`, `independenceKey`, `incidentStart`, `verificationStatus`, `firstReportedAt`, `lastCheckedAt`, `freguesiaSlug`, `placeName`, `precision`, `latitude`, `longitude`, `contentHash`, `sourceId`, `sourceUrl`, `publicationDate`, `retrievalDate`, `geographicArea`. For enums, read `enum IncidentCategory`, `SourceTier`, `VerificationStatus`, `GeoPrecision` in the schema and **copy exact names — do not guess**.
- Existing tests: vitest, `tests/**/*.test.ts`, node environment (`vitest.config.ts`). A throwaway DB is made with `npx prisma migrate deploy` against a temp `DATABASE_URL` (see the top of `tests/updaters.test.ts`).
- CI (`.github/workflows/ci.yml`, job `test`): `npm ci` → typecheck → lint → test → `prisma migrate deploy` → `data:bootstrap` → `data:validate` → `build` → starts `node .next/standalone/server.js` on 1400 and `curl`s pages.
- Map tiles come from `tile.openstreetmap.org` (external); tests must not depend on tiles loading.
- This repo uses Next.js 16 with breaking changes; per `AGENTS.md`, read `node_modules/next/dist/docs/` before touching Next-specific code (this plan should not need to).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck / lint / unit | `npm run typecheck` / `npm run lint` / `npm test` | exit 0 |
| Build | `npm run build` | exit 0 |
| E2E (added by this plan) | `npm run test:e2e` | 4 passed |

## Scope

**In scope**: `package.json` and `package-lock.json` (devDependency `@playwright/test`, pinned to an exact version; script `test:e2e`); `playwright.config.ts` (create); `e2e/seguranca.spec.ts` and `e2e/seed.ts` (create); `.github/workflows/ci.yml` (add steps); `.gitignore` (add `test-results/`, `playwright-report/`); `eslint.config.mjs` only if lint rejects the `e2e/` files; `vitest.config.ts` stays unchanged (it includes only `tests/**`).
**Out of scope**: all of `src/**` — if the test reveals an app bug, STOP and report it rather than fixing it. Any change to `data/voz-torres-vedras.db`.

## Git workflow
Branch `advisor/002-e2e-smoke`. Short imperative commit messages. Do NOT push or open a PR.

## Steps

### Step 1: Install Playwright
`npm install -D @playwright/test@<latest stable, exact>` then `npx playwright install chromium`.
**Verify**: `npx playwright --version` prints a version; `git diff --stat` shows only `package.json` and `package-lock.json`.

### Step 2: Seed script
`e2e/seed.ts` (run with `tsx`, already a dependency — see the `"import": "tsx scripts/import.ts"` script). It reads `DATABASE_URL`, **exits with an error unless the URL contains `e2e`** (never seed the real DB), and inserts ONE incident with the real `PrismaClient`: `incidentStart = now − 1 day`, `verificationStatus` REPORTADO, the point/localidade `precision` value from the schema, `placeName: "Assenta"`, `latitude: 39.1`, `longitude: -9.3`, `sourceUrl: "https://example.test/ocorrencia"`, `sourceLinkPublic: true`, `heldForReview: false`, `archivedAt: null`, `freguesiaSlug` a valid slug from `FREGUESIAS` in `src/lib/alerts.ts`; required strings such as `contentHash`/`independenceKey` can be arbitrary. Print "1 incident".
**Verify** (bash): `DATABASE_URL=file:$PWD/data/e2e.db npx prisma migrate deploy && DATABASE_URL=file:$PWD/data/e2e.db npx tsx e2e/seed.ts` → exit 0 and "1 incident"; then `rm data/e2e.db` (`data/*.db` is already git-ignored).

### Step 3: Playwright config
`playwright.config.ts`: `testDir: "e2e"`, chromium only, `use.baseURL = "http://localhost:1401"`, and a `webServer` whose command deletes `data/e2e.db`, migrates and seeds it, then runs `npm run start -- -p 1401` with `DATABASE_URL=file:<abs>/data/e2e.db` (a single `&&`-chained command is fine; mind Windows and POSIX — prefer a small Node script `e2e/serve.mjs` that does this with `child_process`), `reuseExistingServer: false`. Comment that `npm run build` must have run first.

### Step 4: The spec
`e2e/seguranca.spec.ts`, all on `/seguranca`:
1. **Hydrates**: `.leaflet-container` becomes visible (timeout 15s); text "A carregar o mapa…" is gone; no `console` message of type `error` and no `pageerror` during load (collect with `page.on`; ignore failed requests to `tile.openstreetmap.org`).
2. **Marker opens popup**: exactly one `.leaflet-marker-icon`; click it; `.incident-popup` is visible and contains "Assenta" and a link "Ver fonte original" with `href="https://example.test/ocorrencia"`.
3. **"Ver na lista"**: click `.incident-popup__list`; afterwards `document.activeElement.closest("article")` is non-null (via `page.evaluate`).
4. **Filters**: select, in the control labelled "Tipo de ocorrência", an option whose value differs from the seeded category → text "0 ocorrências visíveis" appears.
**Verify**: `npm run build && npm run test:e2e` → 4 passed.

### Step 5: Script and CI
Add `"test:e2e": "playwright test"` to `package.json`. In `ci.yml` job `test`, between the existing `npm run build` step and the "Testar a aplicação na porta 1400" step, add `npx playwright install --with-deps chromium` and `npm run test:e2e`. Change nothing else in the workflow. Add `test-results/` and `playwright-report/` to `.gitignore`.
**Verify**: `npm run test:e2e` → 4 passed; `npm run lint && npm run typecheck && npm test` → exit 0; `grep -n "test:e2e" .github/workflows/ci.yml package.json` shows both.

## Test plan
The spec is the deliverable. Prove it can fail: temporarily (do not commit) change the popup selector in test 2 to a wrong class and confirm it fails, then revert.

## Done criteria
- [ ] `npm run build && npm run test:e2e` → 4 passed
- [ ] `npm run typecheck`, `npm run lint`, `npm test` exit 0 (at least 173 tests)
- [ ] `git status` shows only in-scope files; no `*.db` or `test-results/` committed
- [ ] `ci.yml` runs `npm run test:e2e` after the build step
- [ ] `plans/README.md` row updated

## STOP conditions
- Enum or field names differ so the seed cannot be written without guessing.
- Tests 1–3 fail in a way that points at app code (a real bug — report the output and console errors; do not edit `src/`).
- Playwright cannot install a browser in your environment.
- You would need to modify `data/voz-torres-vedras.db` or any non-e2e database.

## Maintenance notes
The seeded date is relative to "now", so the test does not rot with the 14-day window. If `Incident` gains required fields, update `e2e/seed.ts` (it fails loudly). Reviewer: check the seed's safety guard and that CI step order keeps build before e2e. Plan 003 reuses this suite to prove a CSP does not break the map.
