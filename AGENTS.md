# Repository Guidelines

## Project Structure & Module Organization

Formbricks runs as a pnpm/turbo monorepo. `apps/web` is the Next.js product surface, with feature modules under `app/` and `modules/`, assets in `public/` and `images/`, and Playwright specs in `apps/web/playwright/`. `apps/storybook` renders reusable UI pieces for review. Shared logic lives in `packages/*`: `database` (Prisma schemas/migrations), `surveys`, `js-core`, `types`, plus linting and TypeScript presets (`config-*`). Deployment collateral is kept in `docs/`, `docker/`, and `helm-chart/`. Unit tests sit next to their source as `*.test.ts` or inside `__tests__`.

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

Turbo runs a task only in packages that define the matching script and **silently skips** the rest.
Every `packages/*` workspace therefore exposes the standard `lint` / `typecheck` / `test` /
`test:coverage` scripts (plus `build` where there is a compile step). Deliberate exceptions:
`config-*` packages hold only config files (no scripts beyond `clean`); `types` has no runtime logic
to test; `email`, `types`, and `vite-plugins` are consumed from source, so they have no `build`;
`apps/storybook` has no unit tests by policy (its components are exercised by the feature journeys in
`apps/web/playwright`). Keep new packages on this matrix or document the exception here.

### Shared dependency versions (pnpm catalog)

Every dependency used by **two or more** workspaces is pinned once in the `catalog:` block of
`pnpm-workspace.yaml`, and each `package.json` references it as `"catalog:"` instead of a version:

```json
"devDependencies": { "typescript": "catalog:", "vitest": "catalog:" }
```

So bumping a shared dependency means editing the catalog entry — never a `package.json`. That is the
whole point: `nodeLinker: hoisted` hides a version split until it breaks, so `apps/web` was typing a
redis 5 client with redis 4's `RedisClientType` and one package was building on a different Vite major
than the other fourteen. Deps with a single consumer deliberately stay in their own `package.json`.

`pnpm lint` runs `scripts/check-catalog.mjs`, which fails if a workspace declares a literal version for
a catalogued name, or if a dependency is declared by 2+ workspaces without being catalogued. A peer
dependency *range* is exempt — it is a compatibility declaration for consumers, not an install pin, so
it may legitimately be looser than the catalog (`packages/survey-ui` declares react `^19.0.0` while
pinning 19.2.6 to build against). Adding a new package needs no wiring: the check resolves the
workspace globs from `pnpm-workspace.yaml` itself.

### Survey Packages Build & Cache

The `@formbricks/surveys` package is pre-compiled (Vite → UMD + ESM) and the built bundle is copied to `apps/web/public/js/`. The Next.js app imports from `dist/`, **not** the source files. This means:

- After any change to `packages/surveys` or its dependencies (`packages/survey-ui`, `packages/types`, etc.), you **must rebuild** for changes to take effect in the running app.
- Turborepo caches build outputs aggressively. Always use `--force` to bypass the cache when iterating on survey packages:
  ```
  rm -rf packages/surveys/dist apps/web/public/js/surveys.* node_modules/.cache/turbo
  pnpm build --filter=@formbricks/surveys... --force
  ```
- The browser also caches the UMD bundle (`surveys.umd.cjs`) served from `public/js/`. After rebuilding, do a **hard refresh** (Cmd+Shift+R / Ctrl+Shift+R) or disable the browser cache via DevTools to pick up the new bundle.
- If changes still don't appear, restart the Next.js dev server (`pnpm dev`).

### Stale package builds after a branch switch

The same trap applies to **every** workspace package consumed through its built output rather than its
source — `@formbricks/ai` and `@formbricks/database` resolve via `dist/` in their `exports` map, so
`apps/web` imports the build, not `src/`. `git switch`, a rebase, or a pull changes `src/` but leaves
`dist/` exactly as it was, and nothing warns you.

**This only bites when you bypass Turborepo.** Running `vitest` or `tsc` directly inside `apps/web`,
`pnpm --filter @formbricks/web test`, or an IDE test runner all skip the task graph — which is how you
usually meet it, iterating on one test file. The root `pnpm test` and `pnpm typecheck` are safe:
`@formbricks/web#test` and `@formbricks/web#typecheck` in `turbo.json` each declare `dependsOn` on
`@formbricks/ai#build`, `@formbricks/database#build` and five more, so turbo rebuilds them before the
suite runs. That is also why the unit-test workflow (`test.yml`) stays green with no build step of its
own — do **not** read "green on CI, red locally" as evidence of a stale `dist/`; both run the same
graph.

The failure looks nothing like a stale build. A symbol added on the branch you just checked out is
absent from `dist/`, so depending on what is missing the import either resolves to `undefined` or fails
outright at module resolution — and both read like real regressions:

- `TypeError: Right-hand side of 'instanceof' is not an object` (the class is in `src/`, not `dist/`)
- a missing named export, or `Failed to resolve entry for package "@formbricks/…"` when `dist/` is
  absent altogether
- `tsc` or Vitest failures in files you never touched

This has cost real time: four failing tests read as a broken `main` from an unrelated PR, when the only
problem was a `dist/` built days earlier. To confirm the diagnosis, check whether a symbol you expect
the package to *export* is in the built output — present in `src/`, absent from `dist/`, is the
signature. (Pick one the entry really re-exports; an internal helper is legitimately absent from
`dist/index.js` and would read as a false positive.)

```shell
grep -rc "MyNewExport" packages/<pkg>/src packages/<pkg>/dist/index.js
```

Recursive on purpose: `packages/ai/src` has nested directories (`providers/`), and a non-recursive
`src/*.ts` glob reports a symbol defined in one of them as missing from *both* sides.

The fix is to rebuild the dependency graph:

```shell
pnpm build --filter=@formbricks/web^...
```

(Dependencies only — `^...` excludes the Next app itself. This is the same command
`.github/workflows/integration-tests.yml` runs before its suites, for exactly this reason.)

### Tailwind & Workspace Package CSS

Tailwind v4 detects sources starting from the consuming app's own root (`apps/web` for the Next.js
PostCSS build, the Vite root for `apps/storybook`) and **never descends into `node_modules`** — which
is exactly where every `@formbricks/*` workspace package is linked. A utility used only inside a
workspace package therefore never reaches the consuming app's stylesheet. Consumed workspace packages
ship their own CSS rather than relying on the app to scan them:

- `@formbricks/surveys` — prebuilt bundle served from `apps/web/public/js/` (see the section above).
- `@formbricks/survey-ui` — exports `./styles` (`dist/survey-ui.css`), scoped to `#fbjs`.
- `@formbricks/email` — ships no stylesheet at all; `@react-email/tailwind` compiles and inlines the
  classes into the email HTML at render time.

If you ever consume a workspace package as raw source **for its styling**, the app has to be told
about that package's files explicitly — detection stops at the app's own root, so nothing else will
pick them up. `apps/storybook` is the worked example: it consumes `packages/survey-ui` as raw source
(its `stories` glob loads `packages/survey-ui/src/**` directly, and Vite aliases the package specifier
to that same source), and it works because `apps/storybook/src/index.css` imports **survey-ui's own
stylesheet**, which carries the `@config` and `@source` covering `packages/survey-ui/src/**` — those
resolve relative to survey-ui's file, so the package declares its own coverage and the app just pulls
it in. Prefer that: let the package own its globs. Only write an `@source` in the app entry when the
files are the app's own (as `index.css` does for `.storybook/**` and `src/**`).

Tailwind is configured CSS-first everywhere. Only two JS/TS Tailwind configs remain
(`packages/survey-ui/tailwind.config.ts` and `packages/surveys/tailwind.config.cjs`) and both are
reached through an explicit `@config` bridge from the package's own stylesheet. Do not add a
`tailwind.config.js` that nothing `@config`s — Tailwind v4 will not load it, and it will silently rot.

## Coding Style & Naming Conventions

TypeScript, React, and Prisma are the primary languages. Use the shared ESLint presets (`@formbricks/config-eslint`) and Prettier preset (110-char width, semicolons, double quotes, sorted import groups). Two-space indentation is standard; prefer `PascalCase` for React components and folders under `modules/`, `camelCase` for functions/variables, and `SCREAMING_SNAKE_CASE` only for constants. When adding mocks, place them inside `__mocks__` so import ordering stays stable.
Import order is set by `@trivago/prettier-plugin-sort-imports` and verified in CI by `pnpm format:check`, so it is not a matter of taste: `__mocks__` imports come first (they carry `vi.mock` calls), then `server-only`, then third-party packages, then `@formbricks/*`, `~/*`, `@/*`, and relative imports. Do not ask for or apply a different order in review — it will fail the check.
We are using SonarQube to identify code smells and security hotspots.
Always mark React component props as `Readonly<>` (e.g., `({ children }: Readonly<MyProps>)`).

## Architecture & Patterns

- Next.js app router lives in `apps/web/app` with route groups like `(app)` and `(auth)`. Services live in `apps/web/lib`, feature modules in `apps/web/modules`.
- Server actions are legacy — do not add new ones. New backend work belongs in an `/api/v3` route consumed from the client with TanStack Query, with server data living in the query cache rather than mirrored into `useState` or Jotai. The existing server actions wrap service calls and return `{ data }` or `{ error }` consistently; keep that contract when changing them.
- Context providers should guard against missing provider usage and use cleanup patterns that snapshot refs inside `useEffect` to avoid React hooks warnings

## Caching

- Use React `cache()` for request-level dedupe and `cache.withCache()` or explicit Redis for expensive data.
- Do not use Next.js `unstable_cache()`.
- Always use `createCacheKey.*` utilities for cache keys.

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

## Date and Time Rendering

- All user-facing dates and times must use shared formatting helpers instead of ad hoc `date-fns`, `Intl`, or `toLocale*` calls in components.
- Locale for display must come from the app language source of truth (`user.locale`, `getLocale()`, or `i18n.resolvedLanguage`), not browser defaults or implicit `undefined` locale behavior.
- Locale and time zone are different concerns: locale controls formatting, time zone controls the represented clock/calendar moment.
- Never infer a time zone from locale. If a product-level time zone source of truth exists, use it explicitly; otherwise preserve the existing semantic meaning of the stored value and avoid introducing browser-dependent conversions.
- Machine-facing values for storage, APIs, exports, integrations, and logs must remain stable and non-localized (`ISO 8601` / UTC where applicable).

## Database & Prisma Performance

- Multi-tenancy: All data must be scoped by Organization or Environment.
- Soft Deletion: Check for `isActive` or `deletedAt` fields; use proper filtering.
- Never use `skip`/`offset` with `prisma.response.count()`; only use `where`.
- Separate count and data queries and run in parallel (`Promise.all`).
- Prefer cursor pagination for large datasets.
- When filtering by `createdAt`, include indexed fields (e.g., `surveyId` + `createdAt`).

## Testing Guidelines

Principles:

- Confidence over coverage. Test behavior and outcomes; avoid brittle implementation-detail tests.
- Prove a behavior at the cheapest level that can fail on it. An E2E test is not a stronger unit test; it
  has a different subject — the journey, not the logic.
- **An E2E test is paid on every PR, by everyone, forever.** The Playwright job is the critical path of the
  PR gate (as of Aug 2026: a ~13 min job, of which ~6 min is the Playwright step itself — the rest is
  install, build and boot — over ~110 tests and ~30 browser-minutes), and its wall clock can never drop
  below its slowest single test. Weigh that before adding one — sometimes the right answer is no test
  at this level.

Which level, concretely:

| The change                                                                      | The level                                     |
| ------------------------------------------------------------------------------- | --------------------------------------------- |
| A new feature area, or a journey across several surfaces                        | One happy-path E2E + unit tests for its logic |
| Business logic, invariants, validation, derivation, permissions — anything pure | Unit test on the `.ts`                        |
| A route's authorization, response shape, or query scoping                       | Unit or integration test on that route        |
| A UI detail inside a feature that already has a happy-path spec                 | Neither — verify manually, say so in the PR   |

A journey across several surfaces means something like survey list → editor → public survey → response,
where the behavior only exists once browser, survey bundle, and server are wired together.

The spec filenames in `apps/web/playwright/` are the inventory of covered areas — check there before
concluding an area has no spec.

The PR's Coverage table names each row's level with one of five words, and the first three are claims a
reviewer can check: `unit (red on main)` fails against the old code, so it proves the bug existed;
`unit (mutation)` only fails if you break the fix, because the code under test is new; `unit (guard)`
passes either way, protecting against a future regression; `e2e` and `manual` say where the check ran. A
red-on-main or mutation row has to be reproducible — the `Rerun:` command above the table, plus the
mutated `file:line` where that row differs from it.

This raises a floor as well as lowering a ceiling. Every feature area ships a happy-path E2E, and an area
with none is a gap rather than a saving (Dashboards and Workflows are the current examples — ENG-2314). A
bug fix inside a feature that already has one almost never needs a second spec — the level still follows
the table above: journey behavior extends that spec, logic goes to a unit test, UI detail to manual QA.

Do:

- E2E tests (Playwright): one spec per **feature area**, not per ticket and not per component. Default to
  adding assertions or a `test.step` to that area's existing spec in `apps/web/playwright`; a new
  `*.spec.ts` is for a feature area that has none, and it takes the area's name (`billing.spec.ts`).
  Follow the suite's own patterns — seed state through Prisma or `/api/v3` instead of clicking it into
  existence (`playwright/utils/accessibility.ts`), one journey per test with `test.step` phases
  (`settings-tags.spec.ts`), assertions at feature level (`survey-overview.spec.ts`) — and run the suite
  before opening a PR.
- Unit tests: cover stable, high-value logic in `.ts` files, such as validators, transformers,
  evaluators, calculations, and edge cases. Keep assertions on inputs and outputs, colocate specs with
  the code they exercise (`utility.test.ts`), and mock network and storage boundaries through helpers
  from `@formbricks/*`.
- Manual QA, especially for releases: verify on staging and file bugs. If a bug is critical, backport and
  re-test. For UI detail below the journey level, manual verification plus a screenshot in the PR is the
  expected answer, not a new spec.
- Run `pnpm test` before opening a PR and `pnpm test:coverage` when touching critical flows.
- Merging, narrowing, or deleting an E2E spec is legitimate work — record it in the PR's Coverage table
  like any other change.

Do not:

- Do not write component or UI unit tests for `.tsx` files. **This is not an instruction to write an E2E
  test instead**: the absence of a component unit test creates no coverage obligation. If a component holds
  logic worth proving, lift that logic into a `.ts` module and unit-test it there; the rendering is
  exercised incidentally by the feature journeys that already cross it.
- Do not E2E a component. A language selector, a breadcrumb, a sidebar's link list, an ARIA attribute on
  one widget, a keystroke inside one editor, a field's validation message, a search box filtering a list —
  none of these justify a browser, a login, and a seeded tenant.
- Do not build a variant matrix. Cover the one case that carries the risk; a second viewport, theme,
  locale, role, or layout needs its own stated reason, and "the adjacent spec does it" is not one.
  Accessibility work on the rendered survey extends the existing axe gate
  (`survey-accessibility.spec.ts`); elsewhere it becomes an assertion in that feature area's own spec.
  Either way, not a per-ticket a11y spec.
- Do not add coverage-driven or low-signal tests.
- Do not write tests that lock implementation details, markup, snapshots, or create churn — an assertion on
  an exact list of nav labels is churn, not coverage.
- Do not create mega or flaky E2E tests; avoid timing hacks (`waitForTimeout`, `slowMo`) and unstable
  dependencies. `@slow` is triage metadata only: nothing in `playwright.config.ts` or CI reads it, so
  tagging a spec does not make its cost go away.

## Documentation (apps/docs)

- Add frontmatter with `title`, `description`, and `icon` at the top of the MDX file.
- Do not start with an H1; use Camel Case headings (only capitalize the feature name).
- Use Mintlify components for steps and callouts.
- If Enterprise-only, add the Enterprise note block described in docs.

## Storybook

- Stories live in `stories.tsx` in the component folder and import from `"./index"`.
- Use `@storybook/react-vite` and organize argTypes into `Behavior`, `Appearance`, `Content`.
- Include Default, Disabled (if supported), WithIcon (if supported), all variants, and edge cases.

## GitHub Actions

- Always set minimal `permissions` for `GITHUB_TOKEN`.
- On `ubuntu-latest`, add `step-security/harden-runner` as the first step.

## Quality Checklist

- Keep code DRY and small; remove dead code and unused imports.
- Follow React hooks rules, keep effects focused, and avoid unnecessary `useMemo`/`useCallback`.
- Prefer type inference, avoid `any`, and use shared types from `@formbricks/types`.
- Keep components focused, avoid deep nesting, and ensure basic accessibility.

## Commit & Pull Request Guidelines

Commits follow a lightweight Conventional Commit format (`fix:`, `chore:`, `feat:`) and usually append the PR number, e.g. `fix: update OpenAPI schema (#6617)`. Keep commits scoped and lint-clean. Pull requests should outline the problem, summarize the solution, and link to issues or product specs. Attach screenshots or gifs for UI-facing work, and record any migrations or env changes under `Migrations & env`, breaking or not. Don't restate what CI already reports (lint, typecheck, unit tests, build, Sonar) — the description carries what those checks cannot show.

Every PR must use `.github/pull_request_template.md` and follow its inline guidance — the template is the source of truth for PR structure. The ticket line at the top is the only place a magic word (`Fixes`, `Ref`, `Closes`) may sit next to a ticket id: Linear and GitHub scan the whole body, so the same pair written in prose — inside backticks too — links and closes that ticket as well. When you need to name the convention in prose, write it without a resolvable id. All QA for a change happens on its own PR before review: the creator shows that every behaviour the diff changes is covered, and lists what is not under `Open gaps`; the reviewer challenges that list and asks for the missing coverage. There is no separate release QA pass per PR — release review only looks for problems arising from the interplay of several changes. Fill every section from the actual diff on PR open, and re-update it in the same turn on every change (new commits, scope or review fixes) so it never drifts — treat a stale section as a bug.

**A PR description is read, not filed.** Keep the whole thing under 350 words outside `<details>` folds — one screen — with lists of at most three bullets of at most twenty words. Open `## What & why` with a `**Was:**` / `**Now:**` pair: one plain sentence for how it behaved before, one for what happens now. User-visible effect first, mechanism second, written for a colleague who has not read the ticket. Under `## Where to look`, link the one to three places that carry the risk so a reviewer can spot-check the code without reading all of it. Detail that does not fit goes into a fold rather than being dropped — the evidence stays in the PR, out of the reviewer's way. Four things never belong at any length: blame archaeology, a defence of a choice nobody questioned or of what you deliberately did not do, commentary on how strong your own tests are, and anything the `Rerun:` line already carries.

The agent note at the bottom names the exact model id the vendor serves — `claude-opus-5`, `gpt-5.1-codex` — not the product it runs in: Claude Code, Codex CLI and Cursor are harnesses, not models, so name the harness in parentheses only when it adds something (`claude-opus-5 (Claude Code 2.1.237)`). The reasoning level is whatever knob that vendor exposes, in that vendor's own units: an effort level (`max`, `high`), a thinking budget (`32k tokens`), or `n/a` where there is no such setting. Read both out of the tool rather than from memory — Claude Code reports them in `/status`, or as the session's `model` and `effort_level`; Codex CLI in `/model` or the line it prints at startup. A value you cannot look up is `unknown`, never a plausible-looking guess and never the harness name standing in for the model.

The checkbox under `## Breaking changes` is a decision you own, not a formality: judge the diff against the template's list of breaking changes and tick it (`- [x]`) when one applies, leave it unticked when none does. It is the only input to the `breaking-change` label, which feeds the release notes and the self-hoster migration guide, so a wrong answer either invents a migration entry or hides one. Re-check it whenever the diff grows. `pr-label-sync.yml` reads nothing but the tick, so the prose below the checkbox cannot change the label — but it is not free-form either: the CodeRabbit `Breaking changes match the diff` check compares the tick against the diff and expects a ticked box to document each breaking change, so explain your answer there in whatever shape fits (table or prose).

## Next.js Documentation

Do not rely on training data for Next.js behavior in this repo. For any Next.js-related work (routing, layouts, server/client components, caching, next.config, etc.), use the `nextjs-docs` skill, which indexes the version-pinned local docs in `.next-docs/`.

<!-- robots:start (managed by .agents/install.sh - do not edit inside this block) -->
## Agent setup (robots)

Shared agent skills and subagents are installed under `.claude/`, and design context under `.agents/` (symlinked from the robots clone; `git -C <clone> pull` refreshes every install). This complements the conventions above; it does not replace them.

- If `.agents/formbricks-context/DESIGN.md` exists, read it before building or reviewing UI for this repo: it indexes the per-surface design guides (tokens, components, motion, the quality bar).
- Skills and subagents live in `.claude/`. Treat the design context above as part of these instructions.
<!-- robots:end -->
