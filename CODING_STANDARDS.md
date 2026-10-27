# Coding Standards

Read at review time: the `code-review` skill's Standards pass and every reviewer apply this file to a diff.
It holds judgement calls. What an implementer needs before the first line stays in `AGENTS.md`, and task
process lives under `docs/agents/`.

## Already Enforced by Tooling

CI checks these, so a review comment about them adds nothing:

- Import order is set by `@trivago/prettier-plugin-sort-imports` and verified in CI by `pnpm format:check`, so it is not a matter of taste: `__mocks__` imports come first (they carry `vi.mock` calls), then `server-only`, then third-party packages, then `@formbricks/*`, `~/*`, `@/*`, and relative imports. Do not ask for or apply a different order in review — it will fail the check.
- `process.env` in `apps/web`: an ESLint rule enforces the env-module rule in `AGENTS.md` ("Environment
  Variables").
- `any`: `@typescript-eslint/no-explicit-any` fails `packages/*`, but is still only a warning in `apps/web`,
  so a new `any` there is worth flagging (see "Quality Checklist").
- We are using SonarQube to identify code smells and security hotspots.

## Coding Style & Naming Conventions

TypeScript, React, and Prisma are the primary languages. Use the shared ESLint presets (`@formbricks/config-eslint`) and Prettier preset (110-char width, semicolons, double quotes, sorted import groups). Two-space indentation is standard; prefer `PascalCase` for React components and folders under `modules/`, `camelCase` for functions/variables, and `SCREAMING_SNAKE_CASE` only for constants. When adding mocks, place them inside `__mocks__` so import ordering stays stable.
Always mark React component props as `Readonly<>` (e.g., `({ children }: Readonly<MyProps>)`).

## Quality Checklist

- Keep code DRY and small; remove dead code and unused imports.
- Follow React hooks rules, keep effects focused, and avoid unnecessary `useMemo`/`useCallback`.
- Prefer type inference, avoid `any`, and use shared types from `@formbricks/types`. This is enforced:
  `@typescript-eslint/no-explicit-any` is an error in `packages/*` and a warning in `apps/web`, where the
  typescript-eslint baseline is being ratcheted to error rule by rule (ENG-2264). Never add new `any`s —
  a warning today becomes an error once its rule's backlog is cleared.
- Keep components focused, avoid deep nesting, and ensure basic accessibility.
- Context providers should guard against missing provider usage and use cleanup patterns that snapshot refs inside `useEffect` to avoid React hooks warnings

## Performance in Review

Performance is an explicit review dimension, not something to discover in production. The bottlenecks that
have reached `main` — N+1 queries, embedding work that never finishes — were all visible in the diff that
introduced them, so every review of data access, of a loop over tenant data, or of an AI/embedding path looks
for them deliberately.

What to look for:

- **N+1 queries** — a query, AI call, or cross-service fetch issued inside a `for`/`map`/`Promise.all` over
  rows. One `findMany` with an `in` filter, an `include`, or a single grouped query replaces it.
- **Unbounded work** — a `findMany` with no `take`, a pagination or retry loop with no ceiling, or a whole
  table pulled into memory and filtered in JS. Bound it and push the filter into the query.
- **Missing indexes** — a new `where`/`orderBy` combination needs an index that serves it; see "Database &
  Prisma Performance" for the `createdAt` rule.
- **Uncached expensive calls** — embeddings, AI calls, and cross-service fetches repeated per request or per
  row belong behind `cache.withCache()` (see "Caching"), batched, or moved into a job.
- **Sequential awaits** — independent queries awaited one after another instead of `Promise.all`.
- **Client-side waterfalls** — the same data fetched twice, requests chained that do not depend on each
  other, or hundreds of calls fired from a loop where one batch request would do.
- **Render amplification** — one state change, interaction or parent update re-rendering a large subtree that
  does not depend on it: a context value rebuilt on every render, unstable props fed into a big list, state
  lifted higher than its readers. Point at the measured cost ("every keystroke re-renders all 500 rows"), not at
  a missing `useMemo` — the Quality Checklist still rules out memoization for its own sake.
- **Large-list rendering** — hundreds or thousands of rows rendered at once with no pagination or
  virtualization.

State the cost in terms of the data: "one query per response, so ~5k queries on a 5k-response survey" is
reviewable, "this might be slow" is not. Where the answer is genuinely unclear, ask the author for numbers
rather than guessing. `.coderabbit.yaml` carries the same checks as path instructions, so the automated review
raises them too — but that is a second pair of eyes, and its silence is not a pass.

## Database & Prisma Performance

- Multi-tenancy: All data must be scoped by Organization or Environment.
- Soft Deletion: Check for `isActive` or `deletedAt` fields; use proper filtering.
- Never use `skip`/`offset` with `prisma.response.count()`; only use `where`.
- Separate count and data queries and run in parallel (`Promise.all`).
- Prefer cursor pagination for large datasets.
- When filtering by `createdAt`, include indexed fields (e.g., `surveyId` + `createdAt`).

## Caching

- Use React `cache()` for request-level dedupe and `cache.withCache()` or explicit Redis for expensive data.
- Do not use Next.js `unstable_cache()`.
- Always use `createCacheKey.*` utilities for cache keys.

## Date and Time Rendering

- All user-facing dates and times must use shared formatting helpers instead of ad hoc `date-fns`, `Intl`, or `toLocale*` calls in components.
- Locale for display must come from the app language source of truth (`user.locale`, `getLocale()`, or `i18n.resolvedLanguage`), not browser defaults or implicit `undefined` locale behavior.
- Locale and time zone are different concerns: locale controls formatting, time zone controls the represented clock/calendar moment.
- Never infer a time zone from locale. If a product-level time zone source of truth exists, use it explicitly; otherwise preserve the existing semantic meaning of the stored value and avoid introducing browser-dependent conversions.
- Machine-facing values for storage, APIs, exports, integrations, and logs must remain stable and non-localized (`ISO 8601` / UTC where applicable).

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
passes either way, protecting against a future regression; `e2e` and `manual` say where the check ran. Every
`unit` and `e2e` row names the test or spec it rests on, in the row or in a `Rerun:` line that names
it — a bare `pnpm test` names nothing. A `unit (red on main)` row is rerunnable from the
`Rerun:` command, or names its own where that differs; a `unit (mutation)` row names the mutated
`file:line` a reviewer edits to turn it red.

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
- API v3 contract tests (Schemathesis): every documented `/api/v3` operation is driven against a real
  instance on each PR and must match the committed OpenAPI bundle — status codes, content type and
  response schema. Nothing to register per endpoint; documenting an operation is what enrolls it. To
  exercise a new one against real data rather than its documented 403, add the resource in
  `packages/database/src/scripts/seed-contract-fixtures.ts`. Harness and local run:
  `docs/api-v3-reference/contract-tests/README.md`.
- API v3 schemas are generated, not handwritten, for the tags listed in
  `packages/api-v3-schemas/scripts/adopted.ts`: edit the spec under `docs/api-v3-reference/src/`, then
  run `pnpm api:v3:sync` (bundle + `pnpm api:v3:schemas`) and commit both outputs. `pnpm lint` fails on a
  stale bundle or stale schemas. Constraints the generator cannot express are pinned in
  `src/testing/unenforced.ts` and enforced by the consuming route's refinement layer; how to adopt a
  resource is in `docs/development/technical-handbook/api-v3-schema-generation.mdx`.
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

## Storybook

- Stories live in `stories.tsx` in the component folder and import from `"./index"`.
- Use `@storybook/react-vite` and organize argTypes into `Behavior`, `Appearance`, `Content`.
- Include Default, Disabled (if supported), WithIcon (if supported), all variants, and edge cases.

## Documentation (root docs/)

- Add frontmatter with `title`, `description`, and `icon` at the top of the MDX file.
- Do not start with an H1; use Camel Case headings (only capitalize the feature name).
- Use Mintlify components for steps and callouts.
- If Enterprise-only, add the Enterprise note block described in docs.

## GitHub Actions

- Always set minimal `permissions` for `GITHUB_TOKEN`.
- On `ubuntu-latest`, add `step-security/harden-runner` as the first step.
