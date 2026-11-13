# Plan 003: Add a Content-Security-Policy header that keeps the map working

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. On any STOP condition, stop and report — do not improvise. When done, update this plan's row in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2b25824..HEAD -- next.config.ts src/app/layout.tsx src/components/IncidentMap.tsx`
> If changed, compare against "Current state"; on a mismatch, STOP. Also confirm `plans/002-e2e-smoke-seguranca.md` is DONE (its suite exists: `ls e2e/seguranca.spec.ts`); if not, STOP — this plan depends on it.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (a too-strict policy silently breaks the map or hydration; the e2e suite is the guard)
- **Depends on**: plans/002-e2e-smoke-seguranca.md
- **Category**: security
- **Planned at**: commit `2b25824`, 2026-11-13

## Why this matters

The site renders text that originates from scraped third-party sources (incident summaries, source names), so a defence-in-depth policy against script injection is valuable. Today `next.config.ts` sets only `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy`; there is no `Content-Security-Policy`. React escapes output and there is no `dangerouslySetInnerHTML` in `src/`, so this is hardening, not a live hole.

## Current state

- `next.config.ts`:

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];
...
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
```

- External origins actually used by the browser: map tiles `https://tile.openstreetmap.org` (`src/components/IncidentMap.tsx:126`, an `<img>` load); fonts via `next/font/google` in `src/app/layout.tsx` (self-hosted by Next at build time, so same-origin); boundaries JSON is same-origin (`/geo/freguesias-torres-vedras.json`); Leaflet sets inline `style` attributes on elements and the map uses inline SVG markers.
- Next.js 16 injects inline bootstrap scripts, so a strict script policy needs either nonces or `'unsafe-inline'`. **The nonce approach requires dynamic rendering of every page and is a different, larger change** (the Next docs, `node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`, state: nonces require dynamic rendering; static pages such as `/metodo` and `/privacidade` get no nonce). This plan deliberately uses the simpler static-header policy and documents the trade-off.
- Per `AGENTS.md`, this Next version has breaking changes: before editing, read the CSP guide above and `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck / lint / unit | `npm run typecheck` / `npm run lint` / `npm test` | exit 0 |
| Build | `npm run build` | exit 0 |
| E2E | `npm run test:e2e` | all pass |
| Header check | `curl -sI http://localhost:1401/seguranca` (while the e2e server or `npm run start -- -p 1401` runs) | shows `content-security-policy:` |

## Scope

**In scope**: `next.config.ts`; `e2e/seguranca.spec.ts` (add one test).
**Out of scope**: `src/**` (no nonce plumbing, no `proxy.ts`); switching pages to dynamic rendering; any other header.

## Git workflow
Branch `advisor/003-csp`. Short imperative commit messages. Do NOT push or open a PR.

## Steps

### Step 1: Add a failing e2e test
In `e2e/seguranca.spec.ts` add test 5: load `/seguranca`, assert the response has a `content-security-policy` header, and that no `securitypolicyviolation` events fire during the flow of tests 1–3 (register `page.addInitScript(() => document.addEventListener("securitypolicyviolation", e => (window.__csp = [...(window.__csp ?? []), e.violatedDirective + " " + e.blockedURI])))` and assert `window.__csp` is empty after opening a popup).
**Verify**: `npm run build && npm run test:e2e` → test 5 FAILS (no header yet); others pass.

### Step 2: Add the policy
In `next.config.ts` add to `securityHeaders` one entry `Content-Security-Policy` whose value is built from an array of directives joined with `; `:
`default-src 'self'`, `script-src 'self' 'unsafe-inline'` (add `'unsafe-eval'` only when `process.env.NODE_ENV === "development"`), `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob: https://tile.openstreetmap.org`, `font-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`. Do NOT add `upgrade-insecure-requests` (the app also runs over plain http on the NAS and in CI). Add a comment explaining why `'unsafe-inline'` is used (static headers cannot carry nonces) and pointing to the Next CSP guide.
**Verify**: `npm run build && npm run test:e2e` → all 5 pass, zero violations recorded.

### Step 3: Check the other pages
With the e2e server (or `npm run start -- -p 1401` against any DB), load `/`, `/reunioes`, `/contratos`, `/estado-das-fontes`, `/metodo` in a Playwright one-off or by `curl -sI` for the header, and open each in the browser pane/Playwright checking for violations.
**Verify**: header present on all five; no `securitypolicyviolation` events. If a page uses an origin not listed (e.g. an embedded video or external image), STOP and report the origin instead of widening the policy.

## Test plan
Test 5 above plus the existing 4. The violation listener is the key assertion: it proves the policy does not block map tiles, markers, popups or hydration.

## Done criteria
- [ ] `npm run build && npm run test:e2e` → 5 passed
- [ ] `npm run typecheck`, `npm run lint`, `npm test` exit 0
- [ ] `grep -n "Content-Security-Policy" next.config.ts` has exactly one match
- [ ] `git status` shows only `next.config.ts` and `e2e/seguranca.spec.ts` changed
- [ ] `plans/README.md` row updated

## STOP conditions
- Plan 002 is not done.
- Any directive needs widening beyond the list above to keep a page working (report the blocked URI and directive).
- `next build` or hydration fails with the header present in a way you cannot trace to a missing origin.
- You find yourself wanting to add nonces or a `proxy.ts` — that is out of scope.

## Maintenance notes
Adding any external image, font, script, tile provider, iframe or API call requires updating this policy; the e2e violation test will flag map changes. `'unsafe-inline'` weakens script protection — a later plan can move to nonces (dynamic rendering, a `proxy.ts`) if the team wants strict CSP; deferred because it makes every page dynamic. Reviewer: scrutinise that no `'unsafe-eval'` ships in production.
