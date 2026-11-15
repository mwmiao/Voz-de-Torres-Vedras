# Plan 006: Add Dependabot for npm, GitHub Actions and the Docker base image

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in "STOP conditions" occurs, stop and report — do not improvise. When done, update the status row for this plan in `plans/README.md` — unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 828b756..HEAD -- .github Dockerfile package.json`
> If `.github/dependabot.yml` already exists, or the workflows/Dockerfile changed, compare against "Current state"; on a mismatch, STOP.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dependencies / dx
- **Planned at**: commit `828b756`, 2026-11-15

## Why this matters

Nothing in the repo watches for outdated dependencies. Next (`16.4.3`), Prisma (`6.19.3`) and Playwright (`1.65.1`) are pinned exactly, and the workflows use third-party actions pinned by tag only. `atualizar-dados.yml` runs with `contents: write` and `pull-requests: write` and uses `peter-evans/create-pull-request@v7`. Without update PRs, security fixes land only when someone remembers to look. Dependabot opens grouped, CI-checked PRs; the existing CI (typecheck, lint, vitest, build, e2e) is the safety net.

## Current state

- `.github/` contains only `workflows/` (`ci.yml`, `atualizar-dados.yml`). No `dependabot.yml`, no Renovate config.
- Package manager: npm (`package-lock.json` at the repo root). Node 22.
- `Dockerfile` uses `FROM node:22-alpine` in three stages.
- `ci.yml` triggers on `pull_request` to `main` and runs everything with no secrets, so Dependabot PRs (which cannot read repository secrets) are fully tested. Only the `publish` job needs `DOCKERHUB_*` secrets, and it runs on `push` only.
- Pinned on purpose: `next` and `eslint-config-next` (`16.4.3`), `prisma` and `@prisma/client` (`6.19.3`), `@playwright/test` (`1.65.1`). `AGENTS.md` warns that this Next.js version has breaking changes, so major bumps need a human.
- Commit and PR language: titles are short imperative English; labels used by automation are in Portuguese (`dados`).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Validate YAML parses | `node -e "const y=require('js-yaml');const d=y.load(require('fs').readFileSync('.github/dependabot.yml','utf8'));console.log(d.version,d.updates.length)"` | prints `2 3` |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope**: create `.github/dependabot.yml`.
**Out of scope**: workflows, `Dockerfile`, `package.json`, lock file; pinning actions to commit SHAs (a separate hardening step); enabling auto-merge.

## Git workflow

- Branch `advisor/006-dependabot`. Short imperative commit message, for example "Add Dependabot for npm, Actions and Docker". Do NOT push or open a PR.

## Steps

### Step 1: Create the config

Create `.github/dependabot.yml` with exactly this content:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    open-pull-requests-limit: 5
    groups:
      minor-and-patch:
        update-types: [minor, patch]
    ignore:
      # Majors of these need a human: Next has breaking changes in this version (see AGENTS.md),
      # Prisma changes the generated client and migrations, Playwright must match the installed browsers.
      - dependency-name: next
        update-types: [version-update:semver-major]
      - dependency-name: eslint-config-next
        update-types: [version-update:semver-major]
      - dependency-name: prisma
        update-types: [version-update:semver-major]
      - dependency-name: "@prisma/client"
        update-types: [version-update:semver-major]
      - dependency-name: "@playwright/test"
        update-types: [version-update:semver-major]

  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    groups:
      actions:
        patterns: ["*"]

  - package-ecosystem: docker
    directory: /
    schedule:
      interval: monthly
```

**Verify**: run the YAML command from the table → prints `2 3`.

### Step 2: Check nothing else changed

**Verify**: `git status --short` → only `.github/dependabot.yml` is new (plus the pre-existing unrelated change to `src/lib/incidents.ts`, if still present, which you must not touch).

## Test plan

No code tests; this is configuration. The YAML parse check is the verification. The real test is the first Dependabot run after merge (Insights → Dependency graph → Dependabot in the GitHub UI).

## Done criteria

- [ ] `.github/dependabot.yml` exists and the parse command prints `2 3`
- [ ] No other files modified by you
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- `.github/dependabot.yml` or a Renovate config already exists.
- The repository is not hosted on GitHub (check `git remote -v`); Dependabot would not apply.
- `js-yaml` is missing from `node_modules` (run `npm ci` first; if it is still missing, validate the file by eye and say so).

## Maintenance notes

- Expect the first week to produce a burst of PRs; the `open-pull-requests-limit` and the `minor-and-patch` group keep it manageable.
- When a deliberate major upgrade of an ignored package is done by hand, leave the ignore in place so Dependabot does not open competing PRs for the next major.
- Deferred on purpose: pinning third-party actions to full commit SHAs. Dependabot can then keep those SHAs current, but doing both at once makes the first PR noisy.
