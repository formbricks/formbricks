# Coding Standards

Read at review time: the `code-review` skill's Standards pass and every reviewer apply this file to a diff.
The design sections, "Existing Patterns" through "Input Limits", are also read when planning a change, so
plans are built to the same calls reviews check. It holds judgement calls. What an implementer needs before
the first line stays in `AGENTS.md`, and task process lives under `docs/agents/`. Where an ADR in
`docs/adr/` decides otherwise for its area, the ADR wins.

## Tooling and Review Scope

Apply the judgment calls below to the diff. Check the relevant tool output before repeating a finding:
Prettier owns formatting and import order; ESLint owns its enabled rules; schema freshness checks own
generated API drift. `packages/config-eslint/` and `apps/web/eslint.config.mjs` define lint severity and
exceptions. A warning is still actionable when CI does not block it.

Static `unstable_cache` imports from `next/cache` are lint errors. `pnpm workflow:check` enforces explicit
permission maps (or caller inheritance for workflows triggered only by `workflow_call`) and runner
hardening first for literal `ubuntu-*` runner labels, including version and architecture pins. Reviewers
still judge whether requested token permissions are minimal and whether runner choices outside this
check need hardening.

## Conventions Awaiting Automated Enforcement

These remain review checks until their enforcement handles the repository's existing patterns:

- React component props use `Readonly<>`.
- Cache keys use `createCacheKey.*` utilities.
- Mock boundaries live in `__mocks__` so their imports register before the module under test.

## Quality Checklist

- Prefer `PascalCase` for React components and folders under `modules/`, `camelCase` for functions and
  variables, and `SCREAMING_SNAKE_CASE` for constants.
- Keep responsibilities focused; consolidate duplicated behavior when it has one reason to change.
- Follow React hooks rules, keep effects focused, and avoid unnecessary `useMemo`/`useCallback`.
- Prefer type inference and shared types from `@formbricks/types`; new `any`s are still findings where
  ESLint reports them only as warnings.
- Keep components focused, avoid deep nesting, and ensure basic accessibility.
- Context providers should guard against missing provider usage and use cleanup patterns that snapshot refs inside `useEffect` to avoid React hooks warnings

## Existing Patterns

- Before designing a piece, find the feature that already does something similar and build the new one the
  same way: module layout, API shape, UI components, tests.
- Extend what nearly fits (a prop, an option, a parameter) rather than copying it. UI reuses the components of
  similar-looking screens, guided by `.agents/formbricks-context/DESIGN.md` when it exists.
- A bad pattern is the exception: name what is wrong with it and fix it. When the change already touches that
  code, the refactor ships in the same PR as its own commit; otherwise it becomes a Linear ticket.

## API Design

- New endpoints start internal: `/api/internal/<resource>`, session auth, no OpenAPI entry and no stability
  promise. Internal routes are v3 in everything but the contract, so they can change freely while the shape
  settles.
- An endpoint is promoted to public `/api/v3` once an external caller (an API key, an integration, an MCP
  tool that writes) needs it: it gains its OpenAPI contract and stability promise, and the app moves to the
  public route rather than keeping an internal twin. A feature built for external callers from day one
  starts public, as dashboards did ([ADR-0002](docs/adr/0002-the-app-uses-the-public-dashboard-api.md)).
- The route framework is in `AGENTS.md` under "Architecture & Patterns" and "API v3".
- Paths name resources, and each response uses the method and status code HTTP defines for the case. Writes
  that can race take the `updatedAt` compare-and-set (409 on mismatch); writes a retry could repeat are
  idempotent.

## File Uploads and Downloads

Uploads:

- Binary files arrive as `multipart/form-data`.
- `Content-Length` is checked before reading and the stream is capped while reading: 413 past the cap.
- The type comes from the bytes (magic numbers, archive layout); the client's `Content-Type` and extension are
  only hints. An unsupported type is 415.
- The uploaded filename is display text: sanitize it before showing it, and build paths only from IDs the
  server generated.
- Files are processed in memory and dropped, unless the feature stores files by design.

Downloads:

- A `GET` returns the file's bytes with its exact `Content-Type`.
- `Content-Disposition: attachment` carries an ASCII `filename` fallback plus `filename*=UTF-8''…`
  (RFC 6266, RFC 8187), built from a sanitized name.
- Tenant data is sent with `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`.
- Spreadsheet cells can never evaluate as formulas. An xlsx cell is written as a typed text cell, never with a
  leading `'`: xlsx keeps the apostrophe as literal text. CSV cells pass through `sanitizeFormulaInjection`
  (`apps/web/lib/utils/file-conversion.ts`).

## Input Limits

- Every dimension of user input has a hardcoded cap: body and file size, decompressed size and archive
  entries, rows, cells, characters per field, array length, nesting depth, records created, AI calls,
  tokens and wall time, concurrent jobs per user and per process.
- Caps are generous: far above real use, yet low enough that no request can exhaust memory, CPU, the database
  or AI spend. A cap that looks too high is fine; a dimension with no cap is the defect.
- Caps are named constants in one module per feature, as in
  `apps/web/modules/survey/import/qsf/limits.ts`, reusing the shared ones that already apply (the v3 array
  budget in `apps/web/app/api/v3/lib/array-budget.ts`).
- Each cap is enforced at the earliest boundary, before parsing or inflating where possible, has a test at the
  boundary, and fails with an error that names the limit (413 for size, 422 otherwise).
- Unbounded database reads are covered under "Performance in Review" below.

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
- For API v3 changes, check that the spec, generated schemas, and route refinements agree. Review
  contract coverage against real fixtures using `docs/api-v3-reference/contract-tests/README.md`;
  generation and adoption procedures live in
  `docs/development/technical-handbook/api-v3-schema-generation.mdx`.
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

## Documentation (Mintlify MDX)

The following conventions apply to published `.mdx` pages. Internal Markdown references such as
`docs/agents/*.md` use a document title (H1) and section headings (H2).

- Add frontmatter with `title`, `description`, and `icon` at the top of the MDX file.
- Do not start with an H1; use Camel Case headings (only capitalize the feature name).
- Use Mintlify components for steps and callouts.
- If Enterprise-only, add the Enterprise note block described in docs.

## GitHub Actions

- Set minimal `permissions` for `GITHUB_TOKEN`. Workflows triggered only by `workflow_call` may inherit
  the caller's scoped permissions; review each caller's map.
- For runners selected by expressions or labels outside `ubuntu-*`, review the resolved runner choices
  and ensure GitHub-hosted Ubuntu jobs harden the runner before other steps.
