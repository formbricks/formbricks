# Checkpoint: 001-010 Workflows PoC Vertical Slice

| Field          | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| Completed date | 2026-05-22                                                  |
| Plan           | [001-010](../plans/001-010-workflows-poc-vertical-slice.md) |
| Changelog      | Added                                                       |

## Summary

Implemented the architecture-faithful Workflows PoC vertical slice. The shipped scope proves the
target shape without implementing the full MVP/Beta backlog: shared browser-safe workflow schemas,
separate `Workflow` and `WorkflowRun` records, v3 API route handlers, server-only Response Completed
matching/enqueue, BullMQ workflow-run execution, no-send Email/Webhook preview actions, and a minimal
dashboard client backed by the same v3 API.

Plans 001-002 through 001-009 remain full MVP/Beta backlog context and are not marked done.

## What Shipped

- Shared workflow zod schemas under `@formbricks/types/workflows`, including lifecycle statuses,
  run statuses, Response Completed trigger, If/Else, and PoC-only `sendEmailPreview` /
  `sendWebhookPreview` actions. `compute` remains documented as deferred and is not accepted.
- Prisma `Workflow` and `WorkflowRun` models with separate definition/run persistence and a composite
  `WorkflowRun` -> `Workflow` relation through `[workflowId, workspaceId]`.
- v3 routes for workflow list/create, get/update/delete, enable/disable, run list, and run detail.
- Server-only Response Completed matcher called from the existing response pipeline after
  workspace/survey context is validated.
- BullMQ `workflow-run.process` job under `packages/jobs`, with PoC attempts set to `1`, fallback
  processor, producer, job schema, and app-level override.
- Graph execution for trigger -> If/Else -> Email/Webhook preview, with no real email sends and no
  outbound webhook requests.
- Dashboard Workflows sidebar section, list page, React Flow builder derived from workflow JSON,
  collapsible node config drawer, run list, and run detail.
- Scoped Jotai + Immer builder state for editor-local workflow name, draft definition, derived React
  Flow nodes, selected node, and drawer state, governed by
  [Decision 004](../../blueprint/decisions/004-workflows-builder-state-management.md).

Additional PoC metadata update on 2026-05-22:

- Workflow creation now opens a dashboard dialog before creating the record.
- The dialog collects required workflow name and optional description, then creates the draft through
  the same v3 API used by external clients.
- `Workflow.description` is persisted as nullable metadata and returned by workflow list/detail API
  responses.
- The builder can edit the workflow name and description while the workflow is editable.

Additional workspace run visibility update on 2026-05-22:

- Added a workspace-level Workflow Runs dashboard page at `/workspaces/[workspaceId]/workflows/runs`.
- Added a workspace-scoped v3 endpoint at `/api/v3/workflows/runs?workspaceId=...` that returns runs
  across workflows with workflow summary metadata.
- The general Workflow Runs page reuses the same table layout as the single-workflow runs page, adds
  a Workflow column, and intentionally omits the builder/runs tabs.
- The main Workflows navigation now links directly to the general Workflow Runs page and highlights
  run pages separately from the workflows list/builder pages.

Additional loading-state update on 2026-05-22:

- Added Next.js `loading.tsx` files for every Workflows route: list, workspace runs, builder,
  single-workflow runs, and run detail.
- Loading states use page-shaped skeletons for titles, actions, tabs, tables, canvas, drawer, and run
  detail panels instead of dummy or generic page-title text.
- The loading skeletons are intended to reduce navigation flash and large layout shifts while route
  segments stream.

## Files Changed

- `apps/web/app/(app)/environments/[environmentId]/workflows/`
- `apps/web/app/api/v3/workflows/`
- `apps/web/modules/workflows/`
- `packages/database/`
- `packages/jobs/`
- `packages/types/workflows/`
- `apps/web/locales/`
- `workbench/blueprint/`
- `workbench/cowork/`

## What The PoC Proved

- The dashboard can be a client of the same v3 API that external clients can call.
- The existing response pipeline can invoke a server-only workflow enqueue path without exposing an
  HTTP trigger endpoint.
- Workflow JSON can remain the source of truth while React Flow nodes and edges are derived views.
- BullMQ can execute workflow runs through the existing `packages/jobs` runtime with app-specific
  handler overrides.
- No-send preview actions are enough to validate graph execution and run observability without
  introducing side-effect safety requirements too early.

## Deferred To Beta

- OpenAPI generation and client endpoint merge.
- Dry-run UI/API, audit logs, idempotency, retries/backoff, batching, retention, run log hardening,
  and production worker topology decisions.
- Real Send Email and outbound Send Webhook behavior, including timeout, retry, latency, auth, and
  secret-storage decisions.
- Compute, AI Agent, scheduling, loops, delays, webhook-received trigger, and extra response/survey
  triggers.
- Follow-ups/Webhooks migration or no-regression guarantees.
- Playwright E2E and broader permission-denial/error-shape coverage.
- React Hook Form for complex node config forms and TanStack Query for server-state caching,
  pagination, polling, and mutation invalidation, only if Beta complexity makes those tools useful.

## Checks Run

- `pnpm install --lockfile-only` — passed.
- `pnpm install` — passed.
- `pnpm --filter @formbricks/database generate` — passed.
- `pnpm --filter @formbricks/jobs build` — passed.
- `pnpm --filter @formbricks/jobs exec vitest run src/queue.test.ts src/processors.test.ts` — passed,
  36 tests.
- `pnpm --filter @formbricks/web exec vitest run app/api/v3/workflows/route.test.ts modules/workflows/lib/workflows-schema.test.ts modules/workflows/lib/executor.test.ts modules/workflows/lib/service.test.ts instrumentation-jobs.test.ts`
  — passed, 23 tests.
- `pnpm --filter @formbricks/web typecheck` — passed.
- `pnpm --filter @formbricks/web typecheck` — passed again after the scoped Jotai + Immer builder
  state refactor.
- `pnpm --filter @formbricks/web typecheck` — passed again after the workflow list UI alignment.
- `pnpm --filter @formbricks/web typecheck` — passed again after the builder canvas toolbar changes.
- `pnpm --filter @formbricks/web typecheck` — passed again after renaming lifecycle UI labels to
  Enable / Enabled.
- `pnpm --filter @formbricks/web typecheck` — passed again after renaming the workflow lifecycle
  status internally from `active` to `enabled` and moving the transition endpoint to `/enable`.
- `pnpm --filter @formbricks/web exec vitest run modules/workflows/lib/service.test.ts app/api/v3/workflows/route.test.ts`
  — passed, 8 tests.
- `pnpm --filter @formbricks/database generate` — passed again after adding
  `Workflow.description`.
- `pnpm --filter @formbricks/web exec vitest run app/api/v3/workflows/route.test.ts modules/workflows/lib/service.test.ts`
  — passed again after adding workflow create metadata, 8 tests.
- `pnpm --filter @formbricks/web typecheck` — blocked by the pre-existing staged navigation change:
  `MainNavigation.tsx` imports `PlayIcon` without using it.
- `pnpm i18n:validate` — blocked by the pre-existing staged navigation change leaving
  `workspace.unify.unify_feedback` unused; the workflow create-dialog keys are present in all web
  locale files.
- `git diff --check` — passed after the workflow create metadata update.
- `pnpm --filter @formbricks/web exec vitest run app/api/v3/workflows/route.test.ts modules/workflows/lib/service.test.ts`
  — passed again after adding the workspace-level runs endpoint and page, 9 tests.
- `pnpm --filter @formbricks/web typecheck` — passed after adding the workspace-level runs endpoint
  and page.
- `pnpm i18n:validate` — passed after adding the workspace-level runs navigation and table labels.
- `git diff --check` — passed after adding the workspace-level runs endpoint and page.
- `pnpm --filter @formbricks/web typecheck` — passed after adding Workflows route loading skeletons.
- `pnpm i18n:validate` — passed after adding Workflows route loading skeletons.
- `git diff --check` — passed after adding Workflows route loading skeletons.
- `pnpm db:migrate:dev` — passed after adding
  `20260522120000_rename_workflow_active_to_enabled`.
- `pnpm i18n:validate` — passed after adding English fallback values for the new Workflows keys to
  all web locale files.
- `pnpm i18n:validate` — passed again after adding Snap to canvas and Reorganize toolbar labels.
- `pnpm i18n:validate` — passed again after replacing Activate / Active lifecycle copy with Enable /
  Enabled.
- `pnpm i18n:validate` — passed again after changing the workflow status locale key from `active`
  to `enabled`.
- `git diff --check` — passed.

## Manual QA

Manual browser demo passed on 2026-05-22 against the local dev stack:

- Applied migrations with `pnpm db:migrate:dev` and refreshed seed data with `pnpm db:seed`.
- Signed in at `http://localhost:3000` as the seeded admin user.
- Confirmed the Workflows main sidebar section, empty list, and create flow.
- Created workflow `cmpga6fzg0009sbmcjw5mje79` through the dashboard and confirmed the builder renders
  the React Flow graph from the v3 workflow response.
- Confirmed the fixed node config drawer collapses and expands.
- Enabled the workflow through the dashboard, then confirmed the status changed to `Enabled`.
- Created a queued run for the enabled matching Response Completed workflow and enqueued only the
  `workflow-run.process` BullMQ job to avoid running legacy response pipeline side effects during
  manual QA.
- Confirmed run `cmpgabuce0001sb60hnwj9l9a` moved to `completed` and produced If/Else `then` output
  followed by `sendEmailPreview` with `sent: false`.
- Confirmed the dashboard run list and run detail display status, timestamps, trigger payload, step
  outputs, and preview action output.
- Disabled the workflow through the dashboard and confirmed the status changed to `Disabled`.
- Browser console had no errors during the Workflows pages checked.

The full response pipeline hook is covered by focused automated tests; the manual demo intentionally
did not enqueue a full `responseFinished` pipeline job because that can also invoke legacy webhooks,
emails, follow-ups, and integrations.

Additional builder-state smoke check on 2026-05-22:

- Loaded the local builder at
  `http://localhost:3000/workspaces/clseedworkspace000000000/workflows/cmpga6fzg0009sbmcjw5mje79`.
- Confirmed the scoped Jotai + Immer builder renders the saved workflow, editable title, React Flow
  nodes, and config drawer.
- Dragged a node on the canvas and confirmed the page stayed interactive with no browser console
  warnings or errors.

Additional workflow list alignment check on 2026-05-22:

- Confirmed the Workflows list uses survey-style card rows with a header row, status pill, created
  date, relative updated time, last-run date/time, and a per-row three-dot menu.
- Confirmed the list page no longer renders secondary tabs.
- Confirmed the row menu exposes Edit, disabled Duplicate, and Delete, with Delete opening the shared
  `DeleteDialog`.
- Confirmed workflow detail navigation only shows Builder and Runs.
- Confirmed the builder canvas shows Snap to canvas and Reorganize controls; React Flow snap uses the
  same 20px spacing as the dotted canvas.
- Confirmed the edit page uses the same workflow status pill as the list page and shows Enable /
  Disable lifecycle actions.
- Confirmed the editor header no longer shows the Delete button and the Save button has no icon.
- Confirmed the local builder shows the `Enabled`/`Disabled` lifecycle vocabulary from the v3-backed
  workflow status, with no browser console errors beyond the existing Formbricks logo image sizing
  warning.

## Notes and Surprises

- The existing response pipeline hook was sufficient for the PoC; no public HTTP trigger endpoint was needed.
- The no-send preview action model gave enough confidence in graph execution and run observability without
  introducing production side-effect safety too early.
- The builder state remained cleaner when persisted workflow JSON, React Flow projection, and local editor state stayed
  separate.
- Some checks were temporarily blocked by pre-existing staged navigation/i18n changes, then passed after the relevant
  workflow updates were completed.

## Implications

- Workflows Beta should harden the proven PoC path instead of replacing it with dashboard-only or server-action-only
  behavior.
- Real side effects require explicit decisions for idempotency, retry, timeout, auth, audit, and secret handling before
  implementation.
- Playwright coverage and OpenAPI generation are the next high-value confidence layers once the interaction model and
  endpoint shape are accepted.

## Follow-Ups

- Decide whether Beta should preserve direct workflow editing of disabled workflows or add an
  explicit "return to draft" transition.
- Add OpenAPI generation once the PoC endpoint shape is accepted.
- Add Playwright coverage after the UI interaction model is reviewed.
- Evaluate React Hook Form and TanStack Query during Beta hardening only when they reduce concrete
  form or server-state complexity; do not treat them as required for the graph editor draft model.
- Turn no-send previews into production side effects only after idempotency, retry, timeout, auth,
  and secret-storage decisions are recorded.
