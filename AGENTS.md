# Repository Guidelines

## Project Structure & Module Organization

Formbricks runs as a pnpm/turbo monorepo. `apps/web` is the Next.js product surface, with feature modules under `app/` and `modules/`, assets in `public/` and `images/`, and Playwright specs in `apps/web/playwright/`. `apps/storybook` renders reusable UI pieces for review. Shared logic lives in `packages/*`: `database` (Prisma schemas/migrations), `surveys`, `js-core`, `types`, plus linting and TypeScript presets (`config-*`). Deployment collateral is kept in `docs/`, `docker/`, and `charts/`. Unit tests sit next to their source as `*.test.ts` or inside `__tests__`.

## Build, Test & Development Commands

Use root `package.json` scripts for commands. Run tests and typechecking through the root Turbo tasks
so their workspace dependencies rebuild first.

Read `docs/agents/monorepo-builds.md` before changing workspace packages, shared dependencies, build
configuration, workspace CSS, or adding tests outside a workspace. Also read it when a package change
is missing from the running app or a direct test command fails after switching branches.

## Architecture & Patterns

- Server actions are legacy — do not add new ones; they are being moved off (ENG-1668). A first-party endpoint goes under `/api/internal/<resource>` (session only, no OpenAPI entry); one for external callers under `/api/v3`. When unsure, default to internal; `CODING_STANDARDS.md` "API Design" has the test. Consume both with TanStack Query and `modules/api/lib/internal-api-client.ts`, keeping server data in the query cache. `scripts/api-boundary/api-boundary.test.ts` only lets the server-action count go down and keeps `apps/web/app/api/INTERNAL_ROUTES.md` in sync. Existing actions return `{ data }` or `{ error }`; keep that contract when changing them.
- MCP tools (`apps/web/modules/mcp`) are thin adapters over v3 operations, registered only through `registerScopedTool`. Before adding a tool or a scope, read "Adding a tool" in `docs/development/technical-handbook/mcp-server.mdx`.
- Code that calls an LLM or embedding model, or exposes MCP tools to agents, follows `docs/development/technical-handbook/ai-code.mdx`, which sets the checks per kind (generation, embeddings, MCP-only tools). Read it before adding or changing such code. Write the prompt-injection assessment (what is exposed if the text is hostile) in the plan and the PR, and check it again against the finished diff. Generation calls also need hardcoded limits, token tracing, the org gate, and a cheap-model test with an injection fixture.

## API v3

Before changing an API v3 request or response schema, read
`docs/development/technical-handbook/api-v3-schema-generation.mdx` for the spec-first generation workflow.
Before adding or changing a documented operation, read `docs/api-v3-reference/contract-tests/README.md`
for contract coverage and fixture setup.

## Environment Variables

In `apps/web`, use `lib/env.ts` on the server and `lib/env-client.ts` on the client; packages under
`packages/*` use their own env access. Read `docs/agents/self-hosting-config.md` before adding an
environment variable or a migration: it lists every file a setting is wired through and what a rolling
upgrade requires.

## i18n (Internationalization)

- All user-facing text must use the `t()` function from `react-i18next`.
- Key naming: use lowercase with dots for nesting (e.g., `common.welcome`).
- Translations are in `apps/web/locales/`. `en-US.json` is the source of truth.
- **Only ever add or edit strings in `en-US.json`.** Never hand-write, translate, or edit the other (non-English) locale files yourself — those are machine-generated from en-US by Lingo.dev.
- After adding or changing an en-US string, run `pnpm i18n` when `LINGO_API_KEY` is set. Without it (cloud sessions), commit `en-US.json` alone: Lingo.dev auto-translates from en-US on commit.

## Coding Standards

`CODING_STANDARDS.md` holds the judgement calls: existing patterns, API design, file uploads and downloads,
input limits, performance, testing levels, caching, dates, Prisma, quality. Read its sections from
"Existing Patterns" through "Input Limits" before planning a change, its "Database & Prisma Performance"
section before changing database access, its "Testing Guidelines" before adding or changing a test, its
"GitHub Actions" section before changing a workflow or shared action, and the whole file when reviewing.

## Commit & Pull Request Guidelines

Read `docs/agents/pull-requests.md` before committing or opening, updating, or reviewing a PR: commit
format, PR template rules, review intake, and independent review passes.

## Performance Testing & SigNoz MCP

Read `docs/agents/performance-testing.md` before running a load test or reading SigNoz telemetry for one.

## Next.js Documentation

Do not rely on training data for Next.js behavior in this repo. Before any Next.js work (routing, layouts, server/client components, caching, next.config), read the version-matched docs Next.js ships in `node_modules/next/dist/docs/`.

## Agent skills

Versioned skills live in `.agents/skills/`; `.claude/skills/` contains symlinks to them. Review with the
`code-review` skill, whose Standards pass requires `CODING_STANDARDS.md`.

### Issue tracker

Linear, Engineering team (`ENG`); skills use the Linear MCP tools. See `docs/agents/issue-tracker.md`.

### Triage labels

No triage labels: the five roles map onto Linear workflow states. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
