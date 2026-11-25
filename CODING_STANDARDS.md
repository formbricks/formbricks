# Coding Standards

Read at review time: the `code-review` skill's Standards pass and every reviewer apply this file to a diff.
It holds judgement calls. The design sections, "Existing Patterns" through "Input Limits", are also read
when planning a change, so a plan meets the same judgement calls a review checks. What an implementer needs
before the first line stays in `AGENTS.md`, and task process lives under `docs/agents/`. Where an ADR in
`docs/adr/` decides otherwise for its area, the ADR wins.

## Tooling and Review Scope

Apply the judgment calls below to the diff. Check the relevant tool output before repeating a finding:
Prettier owns formatting and import order; oxlint owns its enabled rules; schema freshness checks own
generated API drift. `packages/config-oxlint/` and each workspace's `oxlint.config.ts` define lint severity
and exceptions. A warning is still actionable when CI does not block it.

Static `unstable_cache` imports from `next/cache` are lint errors, and so are React component props that
are not read-only (`formbricks/prefer-read-only-props`). `pnpm workflow:check` enforces explicit
permission maps (or caller inheritance for workflows triggered only by `workflow_call`) and runner
hardening first for literal `ubuntu-*` runner labels, including version and architecture pins. Reviewers
still judge whether requested token permissions are minimal and whether runner choices outside this
check need hardening.

## The Review Gate

A review is a gate, not advice. Most findings human reviewers raise on merged PRs break a rule already in
this file, so the review blocks on them before a person looks.

- A finding that cites a rule in this file is **blocking**: it names the rule's section and the hunk that
  breaks it. The review passes only once every blocking finding is fixed. One that cannot be fixed in this
  PR goes under Open gaps with the reason, and stays blocking until a reviewer other than the author
  accepts it there. A smell or taste call that cites no rule is non-blocking and says so.
- A new or changed test is checked against the **red** rule under "Testing Guidelines": the reviewer
  reverts the line it guards (in a scratch copy when the review pushes nothing), runs it, and sees it fail.
  A test that cannot go red is fixed or deleted; it never waits under Open gaps. A review that could not
  run the tests says so and has not passed.
- A finding names its class, and the fix covers the class. A re-review repeats the sibling search ("A fix
  names its siblings") for each earlier finding instead of rechecking only the flagged line: most second
  review rounds were a variant the first fix left open.
- The PR description is reviewed like the code once it exists. Coverage rows, "still covered by" claims,
  the breaking-changes box and Open gaps are claims about the diff, and a claim the code contradicts is a
  finding.
- The ticket does not override this file. Where a ticket asks for something a rule here forbids, quote
  both and treat it as a blocking finding until the ticket's author decides.

## Conventions Awaiting Automated Enforcement

These remain review checks until their enforcement handles the repository's existing patterns:

- Redis cache keys use `createCacheKey.*` utilities. TanStack Query keys are client-side and follow their
  feature's own key factory.

## Quality Checklist

- Prefer `PascalCase` for React components and folders under `modules/`, `camelCase` for functions and
  variables, and `SCREAMING_SNAKE_CASE` for constants.
- Keep responsibilities focused; consolidate duplicated behavior when it has one reason to change.
- Follow React hooks rules, keep effects focused, and avoid unnecessary `useMemo`/`useCallback`.
- Prefer type inference and shared types from `@formbricks/types`. `any` is a lint error everywhere
  (`typescript/no-explicit-any`); in tests, type mocks with `vi.mocked(fn)` (`{ partial: true }` for a
  partial fixture) rather than casting.
- Keep components focused, avoid deep nesting, and ensure basic accessibility.
- A file stays under 5,000 tokens (about 20 KB of source). Past that, split it along its responsibilities
  instead of growing it. A change that pushes a file over the limit splits it in the same PR. Generated
  files, locale files and lockfiles are exempt, and an existing file already over the limit is not a
  reason to refactor it unless the change touches it.
- Context providers should guard against missing provider usage and use cleanup patterns that snapshot refs inside `useEffect` to avoid React hooks warnings
- A control's enabled state comes from the permission the server action checks, passed down from the server,
  not recomputed on the client. A control that looks editable and then fails on save is a finding.
- A change that replaces a mechanism (a tool, a library, a data-fetching path, a refactor) keeps every
  behaviour the old one carried, implicit ones included, or lists what it drops under Open gaps: config
  flags and overrides, cache revalidation and serialization, and the handling of missing or malformed
  input.
- One rule, one source. A rule enforced in two places (client and server validation, an allowlist copied
  from another module) reads one shared definition, or a test keeps the copies equal. A client that
  accepts what the server rejects is a finding.
- Prose follows the code. Docs, code comments, OpenAPI descriptions, ADRs, `AGENTS.md` and the PR
  description that describe behaviour the diff changes are updated in the same PR, and every path or
  symbol they name exists.

## Existing Patterns

- Before designing a piece, find the feature that already does something similar and build the new one the
  same way: module layout, API shape, UI components, tests.
- Extend what nearly fits (a prop, an option, a parameter) rather than copying it. UI reuses the components of
  similar-looking screens, guided by `.agents/formbricks-context/DESIGN.md` when it exists, so the design stays
  consistent.
- Add a new component or design pattern only when no existing one can carry the interaction. Say why in the
  plan and the PR.
- A bad pattern is the exception: name what is wrong with it and fix it. When the change already touches that
  code, the refactor ships in the same PR as its own commit; otherwise it becomes a Linear ticket.
- A fix names its siblings. Search for the same call, predicate or literal, then fix every copy in the same
  PR or list the ones left under Open gaps. A defect found in one place has usually been copied, and most
  follow-up fixes this year were the sibling the first fix missed.

## API Design

- New endpoints start internal ([ADR-0059](docs/adr/0059-internal-endpoints-live-outside-v3.md)):
  `/api/internal/<resource>`, session auth, no OpenAPI entry and no stability promise. Internal routes are
  v3 in everything but the contract, so they can change freely while the shape settles.
- An endpoint is promoted to public `/api/v3` once an external caller (an API key, an integration, an MCP
  tool that writes) needs it: it gains its OpenAPI contract and stability promise, and the app moves to the
  public route rather than keeping an internal twin. A feature built for external callers from day one
  starts public, as dashboards did ([ADR-0002](docs/adr/0002-the-app-uses-the-public-dashboard-api.md)).
- A public `/api/v3` operation ships with its MCP tool in the same PR, so agents can do what API keys can.
  Exceptions are allowed, such as hard deletes, when the PR names them and says why. "Adding a tool" in
  `docs/development/technical-handbook/mcp-server.mdx` covers the tool side.
- The route framework is in `AGENTS.md` under "Architecture & Patterns" and "API v3".
- Paths name resources, and each response uses the method and status code HTTP defines for the case. Writes
  that can race take the `updatedAt` compare-and-set (409 on mismatch); writes a retry could repeat are
  idempotent.
- A gate (sign-up policy, role floor, entitlement, PIN or single-use link, survey status, visibility) is one
  function that every entry point to the data calls, and the PR names the entry points it checked: server
  actions (callable directly, whatever the UI hides), `/api/v1`, `/api/v2`, `/api/v3`, the Better Auth
  endpoints mounted raw at `/api/auth/*` ([ADR-0017](docs/adr/0017-better-auth-native-endpoints-closed.md)),
  public client routes and `/storage`, MCP tools and API-key paths, and the write side of a read-gated
  module. A gate on fewer paths than reach the data is a finding, and so is a second copy of the predicate.
- A security check validates what is actually used. Input is normalized before it is checked, and
  content that is rendered or consumed later is checked on the output of the same transform the consumer
  runs, not on a separate parse of the raw input. A role or privilege grant rests on verified evidence (a
  signed token, a verified email), never on a value the caller controls. A lookup keyed by caller input
  uses `Object.hasOwn` or a `Map`, never `in`, which also matches inherited keys such as `__proto__`.
- Unknown query parameters and body keys are rejected with 400 at every nesting level: `.strict()` on nested
  objects too, and MCP tools register the schema, not its `.shape`. A dropped typo returns a confidently
  wrong answer.
- A change to a shared schema, the API wrapper, or a key's scope changes every route that uses it. A new 400
  or 422, a renamed `meta` field or a widened scope gets a breaking-change entry like any route edit. So
  does removing a released route or MCP tool, changing the type of a value already stored or emitted, and
  moving anything a caller stored (a webhook URL, a token, a config key); outside a major release the old
  one is deprecated beside the new one, not removed.
  Shipped mobile SDKs, js-core's cached environment state and the Zapier app read `/api/v1` and the client
  API without updating, so a field there is renamed only by adding the new one beside the old.
- Unreleased code has no compatibility obligation: released is the line, not merged. Self-hosters and Cloud
  production run published releases — prereleases included — and no workflow deploys `main` on merge, so a
  shape this PR introduces, one an unmerged PR it stacks on introduced, or one merged to `main` that no
  release contains has no consumer: rename, retype or delete it and update every caller in the same PR. An
  alias, deprecated re-export, fallback branch or data backfill for something no release has shipped is a
  finding, not diligence: it is dead weight in the next release, and the next reader has to work out which of
  the two copies is real. From the first release that ships the shape, the rules above apply.

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
- A new or tighter cap applies to what the caller sends, on every write path to that field (create, update,
  add, duplicate, MCP). Rows already stored are read with the read schema, so a cap never makes an existing
  record unreadable or un-patchable: a name-only PATCH on a survey with 101 variables still succeeds.
- Unbounded database reads are covered under "Performance in Review" below.

## Errors

- Client input is validated (`safeParse`, a guarded decode) before any work, and its failures answer 400 or 422. Text bound for Postgres rejects `\u0000`, which Postgres refuses with a 500.
- An error is mapped by where it was raised, not by its class: throw a typed error at the input boundary. A
  `ValidationError` from a stored row, a 429 from a provider, or a storage failure is a server fault, logged
  at `error`.
- A `catch` that carries on names the errors it expects. Infrastructure errors (pool exhaustion, timeouts)
  propagate to the retry that owns them.
- Retries cover transient failures only (network errors, timeouts, 408, 429, 5xx), with backoff that
  honours `Retry-After` when present and a bounded number of attempts; other client errors are final. A
  timeout leaves the outcome unknown, so a retried write is idempotent, deduplicated, or first confirmed not
  to have committed. A call that reports failure in its return value is checked like one that throws.
- A security check fails closed: when it hits a cap, gets partial input or misses a header it relies on,
  it denies rather than treating the gap as a pass. Abuse limits stay closed when Redis is down
  ([ADR-0016](docs/adr/0016-abuse-limits-fail-closed.md)).
- Log a caught error through `loggableError` (`apps/web/lib/utils/loggable-error.ts`): its name and frames,
  never its message. A message can carry prompts, file text, OAuth codes or respondent answers, so a new
  `logger.*({ error })` on a path that handles such content is a finding.

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

- **Tenancy.** An id the caller supplies (URL segment, body field, action input, file key, the target of a
  `connect`) is resolved by a query filtered on the workspace or organization the caller was authorized
  for: `where: { id, workspaceId }`, `connect: { id_workspaceId }`. Authorizing the parent is not enough:
  most cross-tenant fixes shipped this year authorized the URL's workspace and then loaded a nested id
  alone. Columns the server owns (`archivedAt`, `organizationId`, `createdBy`) are omitted from create and
  update input. For a write body with several references, the model is the reference manifest in
  `apps/web/app/api/v3/responses/lib/reference-manifest.ts` (ENG-2861).
- A check that guards a write (a limit, a status, ownership, `finished`, "first user") runs in the same
  transaction as the write, either on a row read `FOR UPDATE` or as the write's own `WHERE`
  (`DELETE … WHERE "archivedAt" IS NOT NULL`). A check read before the transaction is a race. Snapshots for
  audit logs and "previous value" diffs are read under that lock too.
- Inside an interactive transaction every query goes through `tx`; a query on the global `prisma` waits for
  a second pool connection and can deadlock the pool. A lock that guards a count also covers rows that can
  join the counted set while it waits.
- State outside Postgres races the same way. A read-modify-write on Redis or a third-party API is
  serialized across workers or replaced by one atomic write, or one conditional on the value it read (a
  lock alone does not do this once its lease can expire); idempotency makes a retry safe but does not
  prevent a lost update.
- `ON DELETE CASCADE` reaches only Postgres. Deleting a survey, response, workspace, organization or account
  also deletes its storage objects (under the `workspaceId` prefix and the legacy `environmentId` one), its
  Hub records and its pending invites, and its test asserts those deletes.
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

- A test is done when it goes **red**: flip the line it guards (the permission argument, the tenant filter,
  the fix itself) and watch it fail. A test whose fixture already satisfies the assertion cannot go red: a
  synthetic schema in place of the real one, an input already invalid for another reason, a mock of the
  module under test, or a call-site argument nobody asserts.
- E2E tests (Playwright): one spec per **feature area**, not per ticket and not per component. Default to
  adding assertions or a `test.step` to that area's existing spec in `apps/web/playwright`; a new
  `*.spec.ts` is for a feature area that has none, and it takes the area's name (`billing.spec.ts`).
  Follow the suite's own patterns — seed state through Prisma or `/api/v3` instead of clicking it into
  existence (`playwright/utils/accessibility.ts`), one journey per test with `test.step` phases
  (`settings-tags.spec.ts`), assertions at feature level (`survey-overview.spec.ts`) — and run the suite
  before opening a PR.
- Unit tests: cover stable, high-value logic in `.ts` files, such as validators, transformers,
  evaluators, calculations, and edge cases. Keep assertions on inputs and outputs, colocate specs with
  the code they exercise (`utility.test.ts`), and mock at module boundaries with `vi.mock`, reusing a
  shared `__mocks__` module where one exists (`apps/web/lib/__mocks__/database.ts`) rather than
  redefining it inline.
- A unit test that runs an injected `<script>` under jsdom follows
  `apps/web/modules/ui/components/survey/load-surveys-script.test.ts`: the script runs on jsdom's own
  window, not the test's `window`, and its errors fail the run unless the test listens for them.
- For API v3 changes, check that the spec, generated schemas, and route refinements agree. Review
  contract coverage against real fixtures using `docs/api-v3-reference/contract-tests/README.md`;
  generation and adoption procedures live in
  `docs/development/technical-handbook/api-v3-schema-generation.mdx`.
- Manual QA, especially for releases: verify on staging and file bugs. If a bug is critical, backport and
  re-test. For UI detail below the journey level, manual verification plus a screenshot in the PR is the
  expected answer, not a new spec.
- Run `pnpm test` before opening a PR and `pnpm test:coverage` when touching critical flows.
- Merging, narrowing, or deleting an E2E spec is legitimate work — record it in the PR's Coverage table
  like any other change, and name in each row the test that still covers the behaviour, or "none".
  A test that is the only way another test can go red stays, as a `test.step` in a test that survives: the
  positive control for an assertion helper, or the allowed half of an allowed/denied pair whose denied half
  asserts an absence.

Do not:

- Do not write component or UI unit tests for `.tsx` files. **This is not an instruction to write an E2E
  test instead**: the absence of a component unit test creates no coverage obligation. If a component holds
  logic worth proving, lift that logic into a `.ts` module and unit-test it there; the rendering is
  exercised incidentally by the feature journeys that already cross it. When the lift serves a bug fix, make
  it a commit of its own that keeps the behaviour unchanged, and fix in the next commit: `unit (red on main)`
  then means red on the lift commit, and the Coverage row names it.
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
- Do not fix a flaky test by hiding it; fix its cause. A race a user could hit gets a product fix and the
  test stays as it is. A race in the test's own setup waits on a real signal: a response, a URL, an
  element's state, or `expect(...).toPass()` around an action that is safe to repeat. A timing assertion
  counts the work or uses a fake clock instead of measuring wall time, unless wall time is itself the
  property under test (a timing side channel). Such a test is tagged `@timing`, so it runs after the
  parallel suite in the `chromium-timing` project, and asserts on the medians of many interleaved
  samples, never on one measurement: the `@timing` test in `security.spec.ts` is the model. That project
  runs one worker, so `@timing` tests never overlap. Hiding means a sleep, a longer timeout or looser
  threshold, more `retries` (in `playwright.config.ts` or `test.describe.configure`), or quarantine
  (`test.skip`, `test.fixme`).

## Survey Bundles

- Code in `packages/surveys`, `packages/js-core` and `packages/survey-ui` runs inside customer pages, so it
  assumes a hostile host: no global CSS (`*`, `:root`, `@property`), `type="button"` on every button that
  does not submit the survey, nothing that needs `eval` under a strict CSP, and no reliance on host globals
  (`define`, CSS custom properties such as `--spacing`).
- A strict `style-src` reports every element the browser parses with a `style` attribute, even one discarded
  afterwards, and every `<style>` without the host's nonce. Survey text is rich-text HTML full of `style`
  attributes, so markup is never parsed or injected raw: pass it through `stripInlineStyles` or
  `sanitizeSurveyHtml` from `@formbricks/survey-ui`, and write CSS with `textContent`. The `csp-safe`
  lint rules in those four packages flag `DOMParser`, `innerHTML`, `dangerouslySetInnerHTML`,
  `setAttribute("style")` and `createElement("style")`; an exception is disabled on its line with the reason.
  Lint cannot see data, so `apps/web/playwright/survey-csp.spec.ts` renders the built bundle under the
  customer policy with styled text in every rich-text field. A new question type goes into the kitchen sink
  (`playwright/utils/kitchen-sink.ts`) and is covered by both suites; a new rich-text field goes into
  `withStyledText` in the spec.

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
- Each `release/*` branch keeps its own copy of `.github/`. A workflow or shared-action change on `main`
  (runner, toolchain version, pinned action) doesn't reach a maintained release line unless it is
  backported. In the PR, say whether each maintained line needs it. Otherwise the gap shows up only when a
  security backport needs that check, as when `ubuntu-latest` moved to 26.04 and 6.1's
  `Validate Docker Build` failed in setup, because `main`'s runner pin (#9715) never reached that branch.
