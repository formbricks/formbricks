# Repository Guidelines

## Project Structure & Module Organization

Formbricks runs as a pnpm/turbo monorepo. `apps/web` is the Next.js product surface, with feature modules under `app/` and `modules/`, assets in `public/` and `images/`, and Playwright specs in `apps/web/playwright/`. `apps/storybook` renders reusable UI pieces for review. Shared logic lives in `packages/*`: `database` (Prisma schemas/migrations), `surveys`, `js-core`, `types`, plus linting and TypeScript presets (`config-*`). Deployment collateral is kept in `docs/`, `docker/`, and `helm-chart/`. Unit tests sit next to their source as `*.test.ts` or inside `__tests__`.

## Build, Test & Development Commands

- `pnpm install` — install workspace dependencies pinned by `pnpm-lock.yaml`.
- `pnpm db:up` / `pnpm db:down` — start/stop the Docker services backing the app.
- `pnpm dev` — run all app and worker dev servers in parallel via Turborepo.
- `pnpm build` — generate production builds for every package and app.
- `pnpm lint` — apply the shared ESLint rules across the workspace.
- `pnpm test` / `pnpm test:coverage` — execute Vitest suites with optional coverage.
- `pnpm test:e2e` — launch the Playwright browser regression suite.
- `pnpm db:migrate:dev` — apply Prisma migrations against the dev database.

## Coding Style & Naming Conventions

TypeScript, React, and Prisma are the primary languages. Use the shared ESLint presets (`@formbricks/eslint-config`) and Prettier preset (110-char width, semicolons, double quotes, sorted import groups). Two-space indentation is standard; prefer `PascalCase` for React components and folders under `modules/`, `camelCase` for functions/variables, and `SCREAMING_SNAKE_CASE` only for constants. When adding mocks, place them inside `__mocks__` so import ordering stays stable.

## Testing Guidelines

Prefer Vitest with Testing Library for logic in `.ts` files, keeping specs colocated with the code they exercise (`utility.test.ts`). Do not write tests for `.tsx` files—React components are covered by Playwright E2E tests instead. Mock network and storage boundaries through helpers from `@formbricks/*`. Run `pnpm test` before opening a PR and `pnpm test:coverage` when touching critical flows; keep coverage from regressing. End-to-end scenarios belong in `apps/web/playwright`, using descriptive filenames (`billing.spec.ts`) and tagging slow suites with `@slow` when necessary.

## Commit & Pull Request Guidelines

Commits follow a lightweight Conventional Commit format (`fix:`, `chore:`, `feat:`) and usually append the PR number, e.g. `fix: update OpenAPI schema (#6617)`. Keep commits scoped and lint-clean. Pull requests should outline the problem, summarize the solution, and link to issues or product specs. Attach screenshots or gifs for UI-facing work, list any migrations or env changes, and paste the output of relevant commands (`pnpm test`, `pnpm lint`, `pnpm db:migrate:dev`) so reviewers can verify readiness.
