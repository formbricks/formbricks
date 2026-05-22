# Decision: Workflows Technical Architecture

| Field  | Value          |
| ------ | -------------- |
| Status | Accepted       |
| Date   | 2026-05-21     |
| Owner  | Javier Aguilar |

## Context

Workflows need to support trigger-based automation, visual editing, queue-backed execution, structured
step outputs, run logs, and API-driven management. The MVP should remain small enough to ship, while
keeping the data model and execution model open to future workflow types, AI-assisted creation, and
versioning.

The epic and notes reference Twenty workflows as inspiration and call out xyflow / React Flow, BullMQ,
JSON workflow documents, workspace scoping, PostgreSQL JSONB persistence, and run logs.

## Decision

The Workflows MVP uses the following technical direction:

- Use xyflow / React Flow for the workflow diagram and canvas builder.
- Build dashboard screens inside `apps/web` using the existing Next.js dashboard stack: Tailwind,
  shadcn/ui, Radix UI primitives, Lucide icons, and existing Formbricks component patterns.
- Use BullMQ for workflow execution and queueing, with the job system living under
  `packages/jobs`.
- Represent workflow definitions as JSON documents validated by schemas, with a similar modeling
  approach to the prototype at
  `https://github.com/itsjavi/formbricks-workflows/tree/main/app/lib/workflows`.
- Keep workflow zod schemas client-safe and shared across the dashboard, v3 API, OpenAPI generation,
  workers, and dry-run logic. The dashboard should validate drafts locally for immediate feedback, but
  the API must validate the same payload again before persisting or executing anything.
- Split validation into two layers:
  - Pure schema validation: JSON shape, node/edge structure, trigger/action config shape, lifecycle
    enum values, and dry-run request shape. This layer can be imported by browser code.
  - Server-only semantic validation: permissions, workspace scoping, referenced records, lifecycle
    transition authority, webhook URL safety, entitlement checks, and side-effect/idempotency rules.
- Persist workflow configuration and workflow run data in separate PostgreSQL JSONB-backed tables.
- Scope workflows to workspaces. A workspace can own many workflows, and workflow data access follows
  workspace permissions.
- Save every completed action output into the workflow run document so later actions can reference
  earlier outputs and support can inspect run state.
- Add workflow run logs with statuses, timestamps, duration, failure reasons, and step-level output
  references.
- Use an explicit workflow run status vocabulary: `queued`, `running`, `completed`, `failed`, and
  `canceled`. Retries and timeouts are represented as metadata on those statuses instead of adding
  separate MVP run statuses.
- Add simple audit logging from the start, then expand it as the product hardens.
- Prepare internally for workflow versioning, immutable enabled snapshots, rollback/revert, and dry
  runs, even if versioning controls are not shown in the MVP UI.
- Dry runs execute workflows with simulated trigger data in a safe mode that validates configuration,
  evaluates branches/compute steps, and suppresses real external side effects.

PoC scope note: [Decision 003](./003-workflows-mvp-is-proof-of-concept.md) and
[Plan 001-010](../../cowork/plans/001-010-workflows-poc-vertical-slice.md) implement a smaller but
architecture-faithful subset first. The PoC must still use React Flow, shared client-safe zod
schemas, v3 route handlers, BullMQ, separate definition/run records, and no-send Email/Webhook
previews. It explicitly defers dry-run UI/API, audit logging, idempotency/retries, real side effects,
version snapshots, OpenAPI generation, Playwright, i18n validation, and migration of existing
Follow-ups/Webhooks.

## MVP Action and Trigger Direction

- Initial triggers should include response received / response completed and survey completed.
- Webhook received is a valid future trigger but is not needed for the MVP.
- MVP actions should include Send Email, Send Webhook / API Call, Compute / Calculate, and If/Else
  branching.
- Compute / Calculate likely needs a constrained math/string expression interpreter. It must not
  become arbitrary code execution.
- AI Agent action is a good MVP stretch goal when time allows: prompt with variables, model selector,
  and structured output available to later steps.
- Loop/iterator over collections, delay/postpone, and human step/input are valid v2 candidates and
  should not block the MVP.

## Dashboard Surface Direction

- The dashboard needs a configured workflows page and a workflow runs page.
- The builder should keep a similar look and feel to the staged workflow research screenshots in
  `workbench/research/`, while reusing existing Formbricks form components where practical.
- The workflow edit/control panel should be a fixed or absolute drawer over the canvas that can be
  collapsed instead of a normal static sidebar that permanently consumes canvas space.
- Builder-local state management is governed by
  [Decision 004](./004-workflows-builder-state-management.md): scoped Jotai + Immer for the PoC,
  workflow JSON as source of truth, and React Hook Form / TanStack Query only as conditional Beta
  tools when they provide clear benefit.
- The builder should expose a dry-run button that opens a trigger-data simulation form and displays
  the API-provided dry-run result.
- The workflow runs page should show a paginated table with status, metadata, dates, duration, and
  failure state.
- Clicking a run should reveal detailed metadata, action outputs, dates, and logs.
- Sidebar placement remains a product/IA decision. Candidate placements are under Unify Feedback /
  Dashboards, or as its own main sidebar group called Workflows similar to Unify Feedback. The second
  option becomes more compelling if both configured workflows and workflow runs are top-level MVP
  surfaces.

## Consequences

- The engine and schema work must land before the UI becomes more than a client of the API.
- Persisted JSON documents make schema validation, API generation, LLM generation, and MCP usage more
  natural, but require careful versioning and migration rules.
- A shared schema package/module becomes part of the product contract. It must stay dependency-light,
  browser-safe, and tested because it is consumed by both the dashboard and backend.
- Frontend validation improves editor UX and catches invalid workflow drafts before network requests,
  but cannot be treated as security or data-integrity enforcement. The backend remains the source of
  truth for every persisted workflow and every execution.
- Separating config from run data keeps definitions smaller and lets run records grow with logs,
  outputs, retries, and debugging metadata.
- Queue-backed execution introduces operational decisions around idempotency, retry policies,
  concurrency, worker count, horizontal scaling, and batching.
- Queue-backed execution also requires consistent run status transitions: `queued` -> `running`,
  `running` -> `queued` for retry/backoff, `queued` -> `canceled`, and `running` -> terminal
  `completed`, `failed`, or `canceled`.
- Webhook/API actions need explicit timeout, retry, latency tracking, and failure isolation so they
  cannot bring workers down or become the bottleneck.
- The action interface should be shaped so that the existing REST integration clients (Slack,
  Notion, HubSpot, Airtable, Google Sheets under `apps/web/modules/integrations/`) and the existing
  webhook delivery code under `packages/jobs` can be wrapped as workflow actions in a later
  iteration without redesigning the action contract. This is forward-compatibility only; no
  third-party connector is exposed as a workflow action in the MVP.
- Workflow definitions need an explicit lifecycle state machine with `draft`, `enabled`, and
  `disabled` states. Only `enabled` workflows respond to trigger events. The state machine governs
  valid transitions and is exposed through both v3 API endpoints and dashboard controls. The data
  model, API plan, and UI plan must all reference the same set of transitions.
- The MVP Send Webhook / API Call action posts a fixed JSON envelope where `response` carries the
  previous action's output, or the trigger payload at the first step. User-authored body templating
  with variable expressions (for example `$input.action_id`, `$input.response.score`) is
  anticipated for a post-MVP iteration. The action contract should be shaped to absorb templating
  later without breaking existing workflows or the API surface.
- All non-UI TypeScript workflow logic should have automated coverage. Workflow UI behavior should be
  covered through Playwright E2E and manual QA for the full MVP/Beta; the PoC uses a manual demo flow
  in place of Playwright and must not add TSX/component unit tests.

## Alternatives Considered

- Build a bespoke workflow canvas. Rejected because React Flow is a mature fit for graph editing and
  is already aligned with the Twenty research direction.
- Execute workflows synchronously inside request/response paths. Rejected because response spikes,
  webhook latency, retries, and email delivery should not block customer-facing paths.
- Store workflow steps only in normalized relational tables. Deferred because a JSON source of truth
  better supports schema validation, API generation, version snapshots, and LLM/MCP creation for the
  first version.
- Put workflow config and run state in one table/document. Rejected because mutable definitions and
  append-heavy run outputs have different lifecycle, audit, and pagination needs.
- Ship versioning UI in the MVP. Deferred because internal readiness matters first; exposing rollback
  controls can wait.

## Diagrams

This decision is visualized in [`research/docs/diagrams.md`](../../research/docs/diagrams.md): system component map,
create/edit request flow, lifecycle and run-status state machines, run execution flow, indicative
data model, and the existing-asset reuse map.

## Follow-Ups

- Decide the exact workflow schema and zod contracts.
- Decide idempotency keys, retry policy, and side-effect safety for Send Email and Webhook/API actions.
- Decide worker topology, concurrency defaults, and batching/backpressure approach for cloud scale.
- Decide MVP navigation placement before UI implementation.
- Confirm whether AI Agent action belongs in the MVP or in the first beta iteration.
