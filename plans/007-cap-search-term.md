# Plan 007: Cap the length of free-text search terms, in one shared helper

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 828b756..HEAD -- src/lib/search.ts src/lib/filters.ts src/app/alertas/page.tsx src/app/camara/page.tsx src/app/fontes/page.tsx src/app/resumos/page.tsx src/app/seguranca/page.tsx tests/core.test.ts`
> If any changed (plan 005 is expected to have changed `src/lib/filters.ts` and some pages — that is fine as long as the `q` lines below still match), compare the excerpts against the live code; on a mismatch, STOP.
>
> Note: at planning time the working tree also had an uncommitted change in `src/lib/incidents.ts`. It is unrelated; do not touch or commit it.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/005-clamp-page-number.md (both edit `src/lib/filters.ts` and several pages; do 005 first)
- **Category**: security / perf (hardening)
- **Planned at**: commit `828b756`, 2026-11-15

## Why this matters

The search box `q` is normalised and passed straight into database `contains` filters (SQL `LIKE '%…%'`) on public pages, with no length limit. A request with a multi-kilobyte `q` makes SQLite scan every row's `searchText` for a very long needle. At today's data size (about 1.6k contracts) the cost is small, so this is hygiene rather than an active problem, but it is cheap to close and the normalisation is currently repeated in six places. One helper that normalises and caps the term removes the repetition and the gap.

## Current state

`src/lib/search.ts` normalises text (no accents, lower case):

```ts
/** Forma comparável do texto: sem acentos nem maiúsculas. */
export function searchKey(...parts: (string | null | undefined)[]): string {
  return parts
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}
```

Where the search term is derived (line numbers at `828b756`; plan 005 may shift them slightly):

- `src/lib/filters.ts:11` in `decisionWhere` and `:35` in `contractWhere`: `const q = searchKey(params.q).trim();` then `searchText: q ? { contains: q } : undefined`.
- `src/app/alertas/page.tsx:31` (inside `alertWhere`): `const q = searchKey(params.q).trim();`
- `src/app/camara/page.tsx:15`: `const q = searchKey(params.q).trim();` (used for in-memory filtering)
- `src/app/resumos/page.tsx:20`: `const q = searchKey(params.q).trim();`
- `src/app/seguranca/page.tsx:78`: `const q = searchKey(params.q).trim();` (in-memory filtering of category names)
- `src/app/fontes/page.tsx:23-25`, which is different:

```ts
  const q = params.q?.trim() ?? "";
  const key = searchKey(q);
  const where = { type, searchText: key ? { contains: key } : undefined };
```
  Here `q` is also echoed back into the page and the pagination links, so it must stay as it is; only `key` changes.

Conventions: Portuguese comments and strings, English identifiers. Tests are in `tests/core.test.ts` (`describe("filtros", ...)` already imports `searchKey` from `@/lib/search`):

```ts
  it("pesquisa sem depender de acentos nem de maiúsculas", () => {
    expect(decisionWhere({ q: "Moção" }).searchText).toEqual({ contains: "mocao" });
    expect(searchKey("Proteção CIVIL")).toBe("protecao civil");
  });
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| All tests | `npm test` | all pass |
| One file | `npx vitest run tests/core.test.ts` | pass |

## Scope

**In scope**: `src/lib/search.ts`, `src/lib/filters.ts`, and the five pages above (`alertas`, `camara`, `fontes`, `resumos`, `seguranca`), plus `tests/core.test.ts`.
**Out of scope**: `searchKey` itself (it is used elsewhere, for example in the budget modules, and must not change); how `q` is displayed or echoed to the user (never truncate the displayed text); the `searchText` columns and their population in `ingestion/`; page-number handling (plan 005).

## Git workflow

- Branch `advisor/007-cap-search-term` (start from the state after plan 005). Short imperative commit message, for example "Cap the length of search terms". Do NOT push or open a PR.

## Steps

### Step 1: Add the helper

In `src/lib/search.ts`, below `searchKey`, add:

```ts
/** Tamanho máximo de um termo de pesquisa: mais do que isto não é uma pesquisa útil e só encarece a consulta. */
export const MAX_SEARCH_LENGTH = 100;

/** Termo de pesquisa pronto a usar: normalizado, sem espaços nas pontas e limitado a MAX_SEARCH_LENGTH. */
export function searchTerm(value: string | null | undefined): string {
  return searchKey(value).trim().slice(0, MAX_SEARCH_LENGTH).trimEnd();
}
```

(`trimEnd` after the slice so a cut at a space does not leave a trailing space that would change the match.)

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Replace the six derivations

- In `src/lib/filters.ts` (2 places), `alertas`, `camara`, `resumos`, `seguranca`: replace `searchKey(params.q).trim()` with `searchTerm(params.q)`. Update each file's import: add `searchTerm`; remove `searchKey` from the import only if the file no longer uses it (run the lint step to find out).
- In `src/app/fontes/page.tsx`: leave `const q = params.q?.trim() ?? "";` as is, and change `const key = searchKey(q);` to `const key = searchTerm(q);`.

**Verify**: `grep -rn "searchKey(params.q)" src` → no matches. `npm run typecheck && npm run lint` → exit 0.

### Step 3: Tests

In `tests/core.test.ts`, import `searchTerm` and `MAX_SEARCH_LENGTH` from `@/lib/search` (extend the existing import) and add to `describe("filtros", ...)`:

```ts
  it("limita o termo de pesquisa", () => {
    expect(searchTerm("  Moção  ")).toBe("mocao");
    expect(searchTerm(undefined)).toBe("");
    expect(searchTerm("a".repeat(MAX_SEARCH_LENGTH + 50))).toHaveLength(MAX_SEARCH_LENGTH);
    expect(searchTerm(`${"a".repeat(MAX_SEARCH_LENGTH - 1)} bbb`)).toBe("a".repeat(MAX_SEARCH_LENGTH - 1));
  });

  it("aplica o limite nas consultas de decisões e contratos", () => {
    const long = "x".repeat(500);
    expect(decisionWhere({ q: long }).searchText).toEqual({ contains: "x".repeat(MAX_SEARCH_LENGTH) });
    expect(contractWhere({ q: long }).searchText).toEqual({ contains: "x".repeat(MAX_SEARCH_LENGTH) });
  });
```

(Add `contractWhere` to the `@/lib/filters` import in that test file if it is not already imported.)

**Verify**: `npx vitest run tests/core.test.ts` → pass, including the 2 new tests.

## Test plan

Two new tests as above, modeled on the neighbouring `filtros` tests; they cover normalisation, `undefined`, the cap, the trailing-space edge case, and both `*Where` builders.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm run lint` exits 0
- [ ] `npm test` exits 0, with 2 more tests than before this plan
- [ ] `grep -rn "searchKey(params.q)" src` returns no matches
- [ ] `git status` shows only in-scope files modified (plus the pre-existing unrelated `src/lib/incidents.ts` change you did not touch)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- The `q` lines differ from the excerpts in a way other than shifted line numbers.
- Removing `searchKey` from an import breaks another use in the same file (keep both imports instead).
- You find another place that passes user input to a `contains` filter that is not listed here (`grep -rn "contains:" src`); list it in your report rather than changing it.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- Any new search box that feeds a database `contains` filter should use `searchTerm`, not `searchKey(...).trim()`.
- 100 characters is a judgment call. If a legitimate query (for example a full contract title pasted in) is longer, raise `MAX_SEARCH_LENGTH` in one place.
- Reviewer: confirm `fontes` still echoes the user's original text, and that only the database term is capped.
