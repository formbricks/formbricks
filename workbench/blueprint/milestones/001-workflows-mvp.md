# Milestone: Workflows MVP

| Field                 | Value          |
| --------------------- | -------------- |
| Status                | Proposed       |
| Owner                 | Javier Aguilar |
| Target date / horizon | TBD            |

## Objective

Ship the first Workflows MVP with the key engineering design hypotheses implemented: API-first
workflow management, JSON/schema-backed workflow definitions, queue-backed execution, observable
runs, and a dashboard experience for creating workflows and inspecting executions.

The MVP should prove that existing Follow-ups and webhook-style automation can become workflows
without locking Formbricks into a monolithic survey-editor-specific design.

## Proof of Concept Execution Note

The clean implementation stop point for this milestone is
[001-010 Workflows PoC vertical slice](../../cowork/plans/001-010-workflows-poc-vertical-slice.md). It is an
architecture-faithful PoC: v3 route handlers, shared zod schemas, BullMQ execution, separate
workflow definition/run records, React Flow builder, and no-send Email/Webhook previews.

Plan [001-000 PoC readiness and missing contracts](../../cowork/plans/001-000-prototype-readiness-and-contracts.md)
is complete. Plan [001-010 Workflows PoC vertical slice](../../cowork/plans/001-010-workflows-poc-vertical-slice.md)
is implemented and recorded in
[checkpoint 001-010](../../cowork/checkpoints/001-010-workflows-poc-vertical-slice.md). Its readiness
artifacts were:

- [PoC prototype scope](../../research/docs/workflows-prototype-scope.md)
- [API endpoint inventory](../../research/docs/workflows-api-endpoint-inventory.md)
- [Schema sketch](../../research/docs/workflows-schema-sketch.md)
- [Data and jobs sketch](../../research/docs/workflows-data-and-jobs-sketch.md)
- [Trigger hook and IA](../../research/docs/workflows-trigger-hook-and-ia.md)

Plans 001-002 through 001-009 remain the full MVP/Beta backlog. Shipping the PoC does not mark those
plans as done. Use 001-009 next to review the PoC checkpoint and choose what moves into Beta.

## Full MVP / Beta Target Scope

The sections below describe the broader full MVP/Beta target. The PoC implementation is governed by
[001-010](../../cowork/plans/001-010-workflows-poc-vertical-slice.md) and may defer the production-hardening
items listed here until after the PoC checkpoint.

- Create the first Formbricks workflow product surface inspired by Twenty workflows.
- Support the initial automation model: Trigger -> Condition / Branch -> Action.
- Provide response/survey-based triggers:
  - Response Received.
  - Response Completed.
  - Survey Completed.
- Rebuild existing Follow-ups as a workflow:
  - Trigger: response completed.
  - Condition: respondent hit a specific thank-you card.
  - Action: send an email to a teammate or to an email address from the survey response.
- Bring low-hanging existing Formbricks primitives into the MVP:
  - Follow-ups, renamed or reframed as Send Email.
  - Webhooks, reframed as Send Webhook / API Call.
- Acknowledge the existing integration layer (Slack, Notion, HubSpot, Airtable, Google Sheets,
  Webhooks under `apps/web/modules/integrations/` and `packages/jobs`). These connectors stay where
  they are and are not deleted, rewritten, or surfaced as workflow actions in the MVP. They remain
  candidates to be wrapped as workflow actions in a later iteration (for example, "create a Linear
  issue when a survey response is completed"). The MVP action interface should not actively block
  that path.
- Support a workflow lifecycle with three explicit states managed by a small state machine:
  - `draft`: editable, never runs.
  - `enabled`: responds to trigger events.
  - `disabled`: saved but inert; can be re-enabled without losing configuration.
  - Valid transitions: `draft` -> `enabled`, `enabled` <-> `disabled`, and `enabled`/`disabled` ->
    `draft` when the editor needs to make breaking changes.
  - Only `enabled` workflows produce runs. Drafts and disabled workflows never trigger side effects.
  - Lifecycle controls must exist in both the v3 API and the dashboard UI.
- Support MVP action types:
  - Send Email.
  - Send Webhook / API Call. The MVP posts a standardized JSON envelope whose `response` property
    holds the output of the previous action (or the trigger payload at the first step). User-authored
    body templating with variable expressions is intentionally post-MVP (see Non-Goals).
  - Compute / Calculate using trigger data or previous action output.
  - If/Else branching.
- Treat AI Agent as a stretch action depending on time:
  - Prompt with variables.
  - Model selector.
  - Structured output that later actions can reference.
- Use xyflow / React Flow for the diagram/canvas builder.
- Use BullMQ and `packages/jobs` for workflow queueing and execution.
- Integrate into the existing `apps/web` dashboard stack: Next.js, Tailwind, shadcn/ui, Radix UI,
  Lucide icons, and existing dashboard patterns.
- Define workflows as JSON documents validated by schemas.
- Share client-safe zod workflow schemas between the dashboard, v3 API, OpenAPI generation, workers,
  and dry-run logic. The dashboard should validate workflow drafts before submitting them so users get
  immediate node/drawer errors, while the v3 API validates the same payload again before persistence or
  execution.
- Persist workflow config and workflow run data in separate PostgreSQL JSONB tables.
- Scope workflows to workspaces and inherit workspace permissions.
- Persist every completed action's computed/final output in the workflow run document.
- Add workflow run logs with status, failure reason, elapsed time, timestamps, and relevant metadata.
- Use one explicit workflow run status vocabulary for the MVP:
  - `queued`: waiting for a worker or retry attempt.
  - `running`: currently executing.
  - `completed`: finished successfully.
  - `failed`: terminal failure.
  - `canceled`: intentionally stopped before completion.
- Add a dashboard dry-run button for workflows. The dry-run flow opens a form to simulate the
  selected trigger data, validates the workflow configuration, evaluates conditions/branches/compute
  steps, and shows logs/results without sending real emails or webhook/API calls.
- Add simple audit logging from the start.
- Provide UI/API surfaces to list configured workflows and workflow runs.
- Provide a workflow runs table with pagination and status.
- Provide run detail view with metadata, dates, logs, action outputs, and failure information.

## Non-Goals

- Webhook Received trigger in the MVP.
- Scheduling workflows in the MVP.
- Broad integrations beyond Send Webhook / API Call and the existing email/follow-up path.
- Exposing existing third-party connectors (Slack, Notion, HubSpot, Airtable, Google Sheets) as
  workflow actions in the MVP. Reuse is intentionally deferred to a later iteration.
- Loop/iterator over collections.
- Delay/postpone action that pauses the rest of a workflow.
- Human step/input form action.
- Full data mapper or schema creator tool.
- Encrypted storage or secret management for webhook/API headers and secrets in the MVP.
- User-configurable Send Webhook / API Call body templating with variable expressions such as
  `$input.action_id` or `$input.response.score`. This is a planned post-MVP capability; the MVP
  ships a fixed envelope with a `response` field instead.
- Showing workflow versioning/rollback UI in the MVP.
- Arbitrary code execution for Compute / Calculate.
- Replacing all existing integrations with workflows in the first milestone.

## API and Backend Constraints

- Do not use Next.js actions as the primary workflow backend contract.
- Everything that can be done through the UI must also be doable through the v3 API.
- The dashboard UI is a client of the same API that external clients, LLMs, and MCPs can use.
- Before coding the UI, produce a complete list of needed API endpoints and plan missing v3 endpoints.
- Keep OpenAPI documentation in sync. The OpenAPI spec is under `docs/`.
- Shared workflow schemas must stay browser-safe: no Prisma client, auth helpers, env reads, or
  Node-only imports in the pure schema layer.
- Backend validation remains authoritative. Server-only checks cover auth, workspace scoping,
  referenced surveys/responses/contacts, lifecycle transitions, webhook URL safety, entitlements, and
  side-effect/idempotency constraints.
- The main reason for this constraint is to open the door for LLMs and MCPs to create and manage
  workflows directly, while Formbricks moves away from Next.js server actions.

## UI Placement Notes

- Candidate placement from the notes: under Unify Feedback, under Dashboards.
- Competing candidate from the same notes: a main sidebar group called Workflows, similar to Unify
  Feedback, especially if configured workflows and workflow runs are separate first-class pages.
- Final IA should be decided before the dashboard implementation plan starts.
- Design should reuse the existing Formbricks dashboard form components where practical and should
  keep the workflow control panel as a fixed or absolute drawer that can collapse over the canvas.

## Research and Design Inputs

- [Workflows Builder design guidelines](../guidelines/design-guidelines-workflows.md) — visual and
  component blueprint for everything in this milestone with a UI surface. Lists what is reused from
  the dashboard catalog and the net-new components needed.
- [Follow-ups email reference](../../research/images/followups-emails.png)
- [Twenty action choice reference](../../research/images/twenty-design-action-choice.png)
- [Workflow canvas reference](../../research/images/workflows-design-1.png)
- [Workflow controls reference](../../research/images/workflows-design-2-controls.png)
- [Workflow sidebar reference](../../research/images/workflows-sidebar.png)

## Risks and Open Questions

- Prototype/demo implementation should not start directly from the production-oriented milestone scope.
  Plan 001-000 exists to cut the thinnest architecture-proving slice and resolve the concrete endpoint,
  schema, data, job, IA, and trigger-hook contracts first.
- High-volume customers can trigger a workflow run for every survey response. Cloud scale may require
  buffering within a time window and batch processing.
- Webhook/API actions may send custom headers, but encrypted header/secret storage is not supported
  for MVP. The UI must clearly disclose when headers are stored and sent as plain configuration.
- Webhook failures, latency, timeouts, and elapsed time must be tracked. External calls must not bring
  workers down or create global bottlenecks.
- Data privacy depends on workspace scoping. The MVP assumes the workflow creator has permission to
  access the workspace data used in the pipeline.
- Idempotency is required for side-effect safety, especially retries for Send Email and Webhook/API.
- Worker topology, concurrency, parallelism, vertical scaling, horizontal scaling, and retry defaults
  need explicit architecture decisions during implementation.
- Compute / Calculate needs a safe constrained interpreter or expression engine.
- AI Agent action needs a separate decision if included in the MVP because it affects model
  selection, prompt variables, structured output, cost, data privacy, and error handling.

## Related Work

- Epic: [E001 Workflows](../epics/E001-workflows.md)
- Decision: [001 Workflows API-first backend contract](../decisions/001-workflows-api-first-backend-contract.md)
- Decision: [002 Workflows technical architecture](../decisions/002-workflows-tech.md)
- Decision: [003 Workflows MVP is a Proof of Concept](../decisions/003-workflows-mvp-is-proof-of-concept.md)
- Business rules: [001 Workflows glossary and scope](../business-rules/001-workflows-glossary-and-scope.md)
- Architecture diagrams: [research/docs/diagrams.md](../../research/docs/diagrams.md)
- Checkpoints: [001-000 PoC readiness and missing contracts](../../cowork/checkpoints/001-000-prototype-readiness-and-contracts.md),
  [001-010 Workflows PoC vertical slice](../../cowork/checkpoints/001-010-workflows-poc-vertical-slice.md)

## Phase Map

| Phase | Goal                                                                | Status   |
| ----- | ------------------------------------------------------------------- | -------- |
| 0     | Resolve PoC readiness and missing implementation contracts          | Done     |
| P     | Implement architecture-faithful PoC vertical slice                  | Done     |
| A     | Read context, research Twenty, and refine MVP scope                 | Done     |
| B     | Define v3 API requirements and OpenAPI contract                     | Proposed |
| C     | Design workflow schema, persistence, versioning, and permissions    | Proposed |
| D     | Build execution engine, BullMQ jobs, idempotency, and scaling model | Proposed |
| E     | Implement MVP triggers and actions                                  | Proposed |
| F     | Build workflow dashboard UI and API client integration              | Proposed |
| G     | Add run observability, audit logs, dry/test run support             | Proposed |
| H     | Migrate/reframe Follow-ups and Webhooks into workflow concepts      | Proposed |
| I     | Review PoC feedback and plan Beta iteration                         | Proposed |

## Drafted Plans

| Plan                                                                                | Title                                        | Status   | Purpose                                                                                                                                          |
| ----------------------------------------------------------------------------------- | -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [001-000](../../cowork/plans/001-000-prototype-readiness-and-contracts.md)          | PoC readiness and missing contracts          | Done     | Cut the thinnest PoC slice and resolve endpoint, schema, table, job, IA, and trigger-hook contracts before coding.                               |
| [001-010](../../cowork/plans/001-010-workflows-poc-vertical-slice.md)               | Workflows PoC vertical slice                 | Done     | Implemented the architecture-faithful PoC by referencing 001-000 and the minimal subsets of 001-002 through 001-007; deferred 001-008 migration. |
| [001-001](../../cowork/plans/001-001-context-research-and-scope.md)                 | Context, research, and scope                 | Done     | Bootstrap context/research pass covered by the epic, milestone, decisions, business rules, diagrams, and design guide.                           |
| [001-002](../../cowork/plans/001-002-api-requirements-and-openapi-contract.md)      | API requirements and OpenAPI contract        | Proposed | Inventory v3 API endpoints before UI coding and document OpenAPI requirements.                                                                   |
| [001-003](../../cowork/plans/001-003-workflow-schema-data-model-and-permissions.md) | Workflow schema, data model, and permissions | Proposed | Define workflow JSON schemas, JSONB persistence, version readiness, and workspace scoping.                                                       |
| [001-004](../../cowork/plans/001-004-execution-engine-and-jobs.md)                  | Execution engine and jobs                    | Proposed | Build BullMQ-backed workflow execution, worker topology, retries, idempotency, and scale controls.                                               |
| [001-005](../../cowork/plans/001-005-mvp-triggers-and-actions.md)                   | MVP triggers and actions                     | Proposed | Implement response/survey triggers plus email, webhook/API, compute, and if/else actions.                                                        |
| [001-006](../../cowork/plans/001-006-dashboard-workflow-builder-ui.md)              | Dashboard workflow builder UI                | Proposed | Build the React Flow workflow builder and workflow list/run list surfaces as API clients.                                                        |
| [001-007](../../cowork/plans/001-007-run-observability-audit-and-dry-runs.md)       | Run observability, audit, and dry runs       | Proposed | Add run logs, audit events, failure details, elapsed time, and safe test execution.                                                              |
| [001-008](../../cowork/plans/001-008-followups-webhooks-migration-and-qa.md)        | Follow-ups, webhooks, migration, and QA      | Proposed | Reframe existing Follow-ups and Webhooks into workflow concepts without breaking existing behavior.                                              |
| [001-009](../../cowork/plans/001-009-mvp-feedback-and-beta-iteration.md)            | PoC feedback and beta iteration              | Proposed | Review the PoC, gather team/customer feedback where available, and turn learnings into Beta production plans.                                    |

## Full MVP / Beta Deliverables

User-visible outcomes the MVP must support. A user, using either the Formbricks dashboard or the v3
API, should be able to:

- Create a workflow and save it as a `draft`.
- Enable a workflow, disable it, and re-enable it without losing its configuration.
- Return an `enabled` or `disabled` workflow to `draft` when editing breaking changes.
- Configure a response/survey-based trigger (Response Received, Response Completed, Survey Completed)
  and have only `enabled` workflows respond to incoming events.
- Add and configure these MVP actions:
  - Send Email to a teammate or to an email address derived from the survey response.
  - Send Webhook / API Call that posts a standardized JSON envelope to a user-provided URL. The
    envelope's `response` property holds the output of the previous action, or the trigger payload at
    the first step. Body templating with variables (`$input.response.score`, etc.) is not exposed in
    the MVP.
  - Compute / Calculate over constrained math/string operations.
  - If/Else branching that routes execution based on known trigger data or prior step output.
- See a list of configured workflows with their current state (`draft`, `enabled`, `disabled`).
- See a paginated list of workflow runs with status (`queued`, `running`, `completed`, `failed`, or
  `canceled`), dates, and elapsed time.
- Open a run and inspect metadata, dates, elapsed time, per-step inputs/outputs, logs, and failure
  reasons.
- Dry-run a workflow from the dashboard with a form that simulates trigger data and shows validation,
  branch decisions, computed outputs, and no-send side-effect previews.
- Perform every one of the above operations through the v3 API as well as the dashboard UI.
- See clear UI disclosure of MVP limitations: webhook/API headers stored without secret encryption,
  no body templating, no webhook-received trigger, no scheduling.

Concrete acceptance scenarios used during manual QA and integration tests:

- Create a workflow with a Response Completed trigger and a Send Webhook action, enable it,
  submit a matching response, and confirm the configured webhook URL receives the standardized
  payload with the trigger response inside `response`.
- Disable the same workflow, submit another matching response, and confirm no webhook delivery
  occurs and no new run is recorded.
- Reframe an existing Follow-up as a workflow (Response Completed trigger + thank-you-card
  condition + Send Email action) and confirm the email is delivered without regressing the existing
  Follow-ups behavior.
- Create or update the workflow exclusively through the v3 API and confirm the dashboard reflects
  the change.

## Full MVP / Beta Acceptance Criteria

- The Workflows epic is linked from `workbench/blueprint/EPICS.md`.
- MVP milestone and plan sequence are linked from `workbench/blueprint/MILESTONES.md`.
- API endpoint inventory exists before UI implementation starts.
- v3 API supports the same user-facing operations as the dashboard UI.
- OpenAPI generation requirements are documented for every workflow API change.
- Workflow definitions are schema-valid JSON documents.
- The same shared zod schemas are used for dashboard pre-submit validation and v3 API request
  validation, with server-only semantic validation layered on top.
- Workflow config and run data are persisted separately.
- Workspace scoping and permission expectations are documented and tested.
- BullMQ-backed workflow execution supports idempotency, retries, failure isolation, and basic scale
  controls.
- Workflow runs are inspectable through paginated list and detail views.
- Workflow runs use only the MVP status vocabulary: `queued`, `running`, `completed`, `failed`, and
  `canceled`.
- Run logs include status, timing, failure reason, action outputs, and relevant metadata.
- Dry-run API and dashboard flows support simulated trigger data and suppress real side effects.
- Send Email and Send Webhook / API Call actions are implemented from existing Formbricks primitives
  where practical.
- MVP limitations are visible in the UI, especially that webhook/API headers can be configured but
  are not encrypted secret storage.
- Follow-ups can be represented as a workflow without regressing existing behavior.

## Full MVP / Beta Testing Strategy

- Every code-producing implementation plan must add automated coverage for delivered TypeScript
  logic. Prefer Vitest for pure logic, schema validation, action execution, and workers; use API
  integration tests for endpoint behavior, permissions, pagination, OpenAPI-facing schemas, and dry
  runs.
- Shared workflow schemas must have automated tests for valid/invalid definitions, trigger/action
  configs, lifecycle status values, and dry-run request payloads.
- Do not add TSX/component unit tests for workflow UI. UI behavior should be covered by Playwright
  E2E tests for the crucial user flows plus manual QA.
- Crucial E2E flows include create/edit workflow, enable/disable/re-enable, dry-run with simulated
  trigger data, run list/detail inspection, failed action visibility, permission denial, and the
  Follow-ups/Webhooks migration path.

## Changelog Impact

Category: Added

Note: Adds a new Workflows automation surface and reframes existing follow-up/webhook behavior around
triggered workflow execution.

## Full MVP / Beta Manual QA Impact

- Add manual QA coverage for creating, editing, activating, and deactivating workflows.
- Add manual QA coverage for dry-run configuration using simulated trigger data.
- Add manual QA coverage for response/survey triggers.
- Add manual QA coverage for Send Email and Send Webhook / API Call side effects.
- Add manual QA coverage for run list pagination, run detail logs, failure states, retries, and
  dry/test runs.
- Add API/manual QA coverage for workspace scoping and permission denial.

## Decision-Record Check

- Existing decision used: [000 Technology baseline](../decisions/000-baseline.md)
- New decision created: [001 Workflows API-first backend contract](../decisions/001-workflows-api-first-backend-contract.md)
- New decision created: [002 Workflows technical architecture](../decisions/002-workflows-tech.md)
- Future decision likely needed: AI Agent action inclusion and model/data-handling policy.
- Future decision likely needed: production worker topology, concurrency defaults, and batching policy.

- [x] Reviewed and refined by: Javier Aguilar
