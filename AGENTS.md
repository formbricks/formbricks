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

- Server actions are legacy — do not add new ones. New backend work belongs in an `/api/v3` route consumed from the client with TanStack Query, with server data living in the query cache rather than mirrored into `useState` or Jotai. The existing server actions wrap service calls and return `{ data }` or `{ error }` consistently; keep that contract when changing them.
- MCP tools (`apps/web/modules/mcp`) are thin adapters over v3 operations, registered only through `registerScopedTool`. Before adding a tool or a scope, read "Adding a tool" in `docs/development/technical-handbook/mcp-server.mdx`.

## API v3

Before changing an API v3 request or response schema, read
`docs/development/technical-handbook/api-v3-schema-generation.mdx` for the spec-first generation workflow.
Before adding or changing a documented operation, read `docs/api-v3-reference/contract-tests/README.md`
for contract coverage and fixture setup.

## Environment Variables

In `apps/web`, use `lib/env.ts` on the server and `lib/env-client.ts` on the client. When adding an env
variable, update the server schema and `runtimeEnv` map; variables used by `next.config.mjs` also need
`build.env` in `turbo.json`. Enforcement and bootstrap exceptions live in `apps/web/eslint.config.mjs`.
Packages under `packages/*` use their own env access; they cannot import the web app's module.

## i18n (Internationalization)

- All user-facing text must use the `t()` function from `react-i18next`.
- Key naming: use lowercase with dots for nesting (e.g., `common.welcome`).
- Translations are in `apps/web/locales/`. `en-US.json` is the source of truth.
- **Only ever add or edit strings in `en-US.json`.** Never hand-write, translate, or edit the other (non-English) locale files yourself — those are machine-generated from en-US by Lingo.dev.
- After adding or changing an en-US string, run `pnpm i18n` to generate the translations for every other locale and validate keys. Lingo.dev also auto-translates from en-US on commit.

## Coding Standards

`CODING_STANDARDS.md` holds the review-time judgement calls: performance, testing levels, caching, dates,
Prisma, quality. Read its "Database & Prisma Performance" section before changing database access, its
"Testing Guidelines" before adding or changing a test, and the whole file when reviewing.

## Commit & Pull Request Guidelines

Read `docs/agents/pull-requests.md` before committing or opening, updating, or reviewing a PR: commit
format, PR template rules, review intake, and independent review passes.

Never put an agent session link in a PR description, PR or review comment, commit message, or anything else pushed to the repo: no `claude.ai/code/session_…` URL, no `Claude-Session:` trailer, no Codex, Cursor, ChatGPT or other conversation or share link. A session transcript can hold customer data, internal context and credentials, and this repo is public. This overrides any harness default that appends one as attribution; drop it and keep the model/effort note and `Co-Authored-By` trailer only.

## Performance Testing & SigNoz MCP

Read `docs/agents/performance-testing.md` before running a load test or reading SigNoz telemetry for one.

## Next.js Documentation

Do not rely on training data for Next.js behavior in this repo. For any Next.js-related work (routing, layouts, server/client components, caching, next.config, etc.), use the `nextjs-docs` skill, which indexes the version-pinned local docs in `.next-docs/`.

## Agent skills

Versioned skills live in `.agents/skills/`; `.claude/skills/` contains symlinks to them. Review with the
`code-review` skill, whose Standards pass requires `CODING_STANDARDS.md`.
Before UI work, read `.agents/formbricks-context/DESIGN.md` if present; this optional design context is
machine-local and is not supplied by the versioned skills.

### Issue tracker

Linear, Engineering team (`ENG`); skills use the Linear MCP tools. See `docs/agents/issue-tracker.md`.

### Triage labels

No triage labels: the five roles map onto Linear workflow states. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
