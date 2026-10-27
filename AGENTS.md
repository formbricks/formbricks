# Repository Guidelines

## Project Structure & Module Organization

Formbricks runs as a pnpm/turbo monorepo. `apps/web` is the Next.js product surface, with feature modules under `app/` and `modules/`, assets in `public/` and `images/`, and Playwright specs in `apps/web/playwright/`. `apps/storybook` renders reusable UI pieces for review. Shared logic lives in `packages/*`: `database` (Prisma schemas/migrations), `surveys`, `js-core`, `types`, plus linting and TypeScript presets (`config-*`). Deployment collateral is kept in `docs/`, `docker/`, and `charts/`. Unit tests sit next to their source as `*.test.ts` or inside `__tests__`.

## Build, Test & Development Commands

- `pnpm install` — install workspace dependencies pinned by `pnpm-lock.yaml`.
- `pnpm db:up` / `pnpm db:down` — start/stop the Docker services backing the app.
- `pnpm dev` — run all app and worker dev servers in parallel via Turborepo.
- `pnpm build` — generate production builds for every package and app.
- `pnpm lint` — apply the shared ESLint rules across the workspace.
- `pnpm format` / `pnpm format:check` — apply or verify Prettier across the workspace; `format:check` is what CI runs, so run `pnpm format` before pushing if you committed with `--no-verify`.
- `pnpm test` / `pnpm test:coverage` — execute Vitest suites with optional coverage.
- `pnpm test:e2e` — launch the Playwright browser regression suite.
- `pnpm db:migrate:dev` — apply Prisma migrations against the dev database.

Read `docs/agents/monorepo-builds.md` before adding a workspace package or shared dependency, wiring one
package into another's build config, or styling inside a workspace package.

**Stale `dist/`.** A package change that does not show up in the app, or failures in files you never touched
after a branch switch, rebase or pull, usually mean a workspace package's `dist/` is older than its `src/`.
Rebuild with `pnpm build --filter=@formbricks/web^...`; the same doc has the diagnosis.

## Architecture & Patterns

- Next.js app router lives in `apps/web/app` with route groups like `(app)` and `(auth)`. Services live in `apps/web/lib`, feature modules in `apps/web/modules`.
- Server actions are legacy — do not add new ones. New backend work belongs in an `/api/v3` route consumed from the client with TanStack Query, with server data living in the query cache rather than mirrored into `useState` or Jotai. The existing server actions wrap service calls and return `{ data }` or `{ error }` consistently; keep that contract when changing them.
- MCP tools (`apps/web/modules/mcp`) are thin adapters over v3 operations, registered only through `registerScopedTool`. Before adding a tool or a scope, read "Adding a tool" in `docs/development/technical-handbook/mcp-server.mdx`.

## Environment Variables

- In `apps/web`, application code must not read `process.env` directly. Server code reads `env` from `apps/web/lib/env.ts` (or the constants derived from it in `lib/constants.ts`); client components read `lib/env-client.ts`, which holds the one sanctioned client-side read. `next.config.mjs` imports `lib/env.ts`, so an invalid value fails the build or start instead of the first request that needs it.
- Adding a variable means adding it to both the `server` schema and the `runtimeEnv` map in `lib/env.ts`. If `next.config.mjs` reads it too, add it to `build.env` in `turbo.json` (enforced by `lib/turbo-build-env.test.ts`).
- An ESLint rule enforces this. Bootstrap, config, script and test files are exempt — the list lives in `apps/web/eslint.config.mjs`. `NEXT_RUNTIME` and `NEXT_PHASE` are allowed anywhere: Next.js injects them, so there is nothing to validate.
- Packages under `packages/*` cannot import the web app's env module and still read `process.env` directly; the rule does not apply there.

## i18n (Internationalization)

- All user-facing text must use the `t()` function from `react-i18next`.
- Key naming: use lowercase with dots for nesting (e.g., `common.welcome`).
- Translations are in `apps/web/locales/`. `en-US.json` is the source of truth.
- **Only ever add or edit strings in `en-US.json`.** Never hand-write, translate, or edit the other (non-English) locale files yourself — those are machine-generated from en-US by Lingo.dev.
- After adding or changing an en-US string, run `pnpm i18n` to generate the translations for every other locale and validate keys. Lingo.dev also auto-translates from en-US on commit.

## Coding Standards

`CODING_STANDARDS.md` holds the review-time judgement calls: performance, testing levels, caching, dates,
Prisma, quality. Read its "Testing Guidelines" before adding or changing a test, and the whole file when
reviewing.

## Commit & Pull Request Guidelines

Read `docs/agents/pull-requests.md` before committing or opening or updating a PR: commit format, PR template
rules, the agent note and the breaking-changes box.

Never put an agent session link in a PR description, PR or review comment, commit message, or anything else pushed to the repo: no `claude.ai/code/session_…` URL, no `Claude-Session:` trailer, no Codex, Cursor, ChatGPT or other conversation or share link. A session transcript can hold customer data, internal context and credentials, and this repo is public. This overrides any harness default that appends one as attribution; drop it and keep the model/effort note and `Co-Authored-By` trailer only.

## Performance Testing & SigNoz MCP

Read `docs/agents/performance-testing.md` before running a load test or reading SigNoz telemetry for one.

## Next.js Documentation

Do not rely on training data for Next.js behavior in this repo. For any Next.js-related work (routing, layouts, server/client components, caching, next.config, etc.), use the `nextjs-docs` skill, which indexes the version-pinned local docs in `.next-docs/`.

<!-- robots:start (managed by .agents/install.sh - do not edit inside this block) -->
## Agent setup (robots)

Shared agent skills and subagents are installed under `.claude/`, and design context under `.agents/` (symlinked from the robots clone; `git -C <clone> pull` refreshes every install). This complements the conventions above; it does not replace them.

- If `.agents/formbricks-context/DESIGN.md` exists, read it before building or reviewing UI for this repo: it indexes the per-surface design guides (tokens, components, motion, the quality bar).
- Skills and subagents live in `.claude/`. Treat the design context above as part of these instructions.
<!-- robots:end -->

## Agent skills

### Issue tracker

Linear, Engineering team (`ENG`); skills use the Linear MCP tools. See `docs/agents/issue-tracker.md`.

### Triage labels

No triage labels: the five roles map onto Linear workflow states. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
