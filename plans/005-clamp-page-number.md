# Plan 005: Make `?pagina=` safe, with one shared parser instead of five copies

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 828b756..HEAD -- src/lib/filters.ts src/app/alertas/page.tsx src/app/contratos/page.tsx src/app/fontes/page.tsx src/app/resumos/page.tsx src/app/reunioes/page.tsx tests/core.test.ts`
> If any of these changed, compare the "Current state" excerpts against the live code; on a mismatch, STOP.
>
> Note: at planning time the working tree also had an uncommitted change in `src/lib/incidents.ts`. It is unrelated; do not touch or commit it.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `828b756`, 2026-11-15

## Why this matters

Five public list pages parse the page number as `Math.max(1, Number(params.pagina) || 1)`. That turns `?pagina=abc` into 1, but lets `1e21` and `Infinity` through. Prisma then rejects `skip` and the page returns a 500. Verified against the e2e database: `skip` of `2e22` fails with "Unable to fit value 2e+22 into a 64-bit signed integer", and `Infinity` fails with "Argument `skip` is missing"; `1.5` and `3` work. Anyone (or any crawler) can trigger it with one URL. The fix is one shared helper that always returns a safe integer, replacing the five copies.

## Current state

The same line appears in five pages (line numbers at `828b756`):

- `src/app/alertas/page.tsx:48`
- `src/app/contratos/page.tsx:34`
- `src/app/fontes/page.tsx:22`
- `src/app/resumos/page.tsx:19`
- `src/app/reunioes/page.tsx:38`

```ts
const page = Math.max(1, Number(params.pagina) || 1);
```

Each page then uses `skip: (page - 1) * PAGE_SIZE` in a Prisma `findMany`, and passes `page` to `<Pagination page={page} pages={pages} ... />`.

`src/lib/filters.ts` is the home for query-string helpers (`queryString`, `searchParamsObject`, `decisionWhere`, `contractWhere`). It exports `type SearchParams = Record<string, string | undefined>`. `fontes/page.tsx` types its params as `{ tipo?: string; pagina?: string; q?: string }`, which is assignable to a plain `string | undefined`; so the helper should take the raw value, not the whole params object.

Conventions: comments and user-visible strings are in European Portuguese; identifiers are English. Existing tests live in `tests/core.test.ts`, in `describe("filtros", ...)`, using vitest and the `@/` alias, for example:

```ts
  it("omite parâmetros vazios", () => {
    expect(queryString({ q: "", ordem: "valor" }, { pagina: "2" })).toBe("ordem=valor&pagina=2");
  });
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| All tests | `npm test` | all pass (183 before this plan) |
| One file | `npx vitest run tests/core.test.ts` | pass |

## Scope

**In scope**:
- `src/lib/filters.ts` (add `pageNumber`)
- the five page files listed above (replace the line)
- `tests/core.test.ts` (add tests)

**Out of scope**:
- Any change to `PAGE_SIZE`, `Pagination`, or the Prisma queries.
- The `q` search-term handling (plan 007 owns it; do not touch it here).
- `src/lib/incidents.ts` (unrelated uncommitted change).

## Git workflow

- Branch `advisor/005-clamp-page-number`. Commit messages are short imperative English (for example "Share stacked table markup and move displayTitle to its own module"). Do NOT push or open a PR.

## Steps

### Step 1: Add the helper

In `src/lib/filters.ts`, after the `SearchParams` type, add:

```ts
/** Ceiling for `?pagina=`: far beyond any real list, and safe for Prisma's `skip`. */
const MAX_PAGE = 10_000;

/** Página pedida na ligação: um inteiro entre 1 e MAX_PAGE. Qualquer outro valor (texto, decimal, infinito) passa a 1. */
export function pageNumber(value: string | undefined): number {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1;
}
```

Behavior to preserve: `"3"` → 3; `undefined`, `""`, `"abc"`, `"0"`, `"-2"` → 1. New behavior: `"1.5"` → 1 (previously 1.5, which worked by accident), `"1e21"`/`"Infinity"` → 1, `"99999"` → 10000.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Use it in the five pages

In each page, import `pageNumber` from `@/lib/filters` (extend the existing `@/lib/filters` import if the page already has one; `alertas`, `fontes` and `resumos` may not) and replace the line:

```ts
const page = pageNumber(params.pagina);
```

Keep import ordering consistent with the file (alphabetical by module path, as in the existing imports).

**Verify**: `grep -rn "Number(params.pagina)" src` → no matches. `npm run typecheck && npm run lint` → exit 0.

### Step 3: Tests

Add to `describe("filtros", ...)` in `tests/core.test.ts` (and add `pageNumber` to the existing `@/lib/filters` import at the top):

```ts
  it("limita a página pedida a um inteiro seguro", () => {
    expect(pageNumber("3")).toBe(3);
    expect(pageNumber(undefined)).toBe(1);
    for (const bad of ["", "abc", "0", "-2", "1.5", "1e21", "Infinity", "NaN"]) expect(pageNumber(bad)).toBe(1);
    expect(pageNumber("99999")).toBe(10_000);
  });
```

**Verify**: `npx vitest run tests/core.test.ts` → pass, including the new test.

## Test plan

One new test as above, modeled on the neighbouring `filtros` tests. The failing inputs (`1e21`, `Infinity`) are the regression this plan fixes.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0, with one more test than before
- [ ] `grep -rn "Number(params.pagina)" src` returns no matches
- [ ] `git status` shows only the in-scope files modified (plus the pre-existing `src/lib/incidents.ts`, which you did not touch)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- Any of the five lines differs from the excerpt (drift), or a sixth copy of the pattern exists (`grep -rn "pagina" src`).
- A page needs `page` to be something other than an integer (for example a page passes it to something that expects a decimal).
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Any new paginated page must use `pageNumber`; the grep in the done criteria is the quick check.
- Reviewer: confirm `1.5` now maps to page 1 rather than being passed through. It worked before only by accident.
- Plan 007 also edits `src/lib/filters.ts`; do 005 first to avoid a merge conflict.
