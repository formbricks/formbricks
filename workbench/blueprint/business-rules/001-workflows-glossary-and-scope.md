# Business Rule: Workflows Glossary and Scope

| Field         | Value          |
| ------------- | -------------- |
| Status        | Proposed       |
| Owner         | Javier Aguilar |
| Last reviewed | 2026-05-21     |

## Rule Statement

Workflows are workspace-scoped automation definitions and executions. A workflow can use data that
the owning workspace is allowed to access, and workflow runs persist step inputs, outputs, status,
timestamps, and logs for debugging, support, auditability, and downstream step references.

PoC scope note: [Decision 003](../decisions/003-workflows-mvp-is-proof-of-concept.md) and
[Plan 001-010](../../cowork/plans/001-010-workflows-poc-vertical-slice.md) govern the first
architecture-faithful implementation slice. That PoC proves a smaller subset: Response Completed,
If/Else, no-send Email/Webhook previews, minimal v3 API, BullMQ execution, separate definition/run
records, and basic run visibility. The dry-run, audit, idempotency/retry, real side-effect,
versioning, OpenAPI, Playwright, and migration rules below remain full MVP/Beta targets unless the
PoC plan explicitly includes them.

## Applies To

- Workflow definitions.
- Workflow versions.
- Workflow triggers.
- Workflow actions and conditions.
- Workflow runs and run logs.
- Workflow dry runs and test runs.
- v3 API endpoints and dashboard UI for workflow management.

## Does Not Apply To

- General-purpose marketing automation outside Formbricks feedback flows.
- Arbitrary CRM replacement behavior.
- Unscoped cross-organization automation.
- v2 workflow ideas that are intentionally postponed from the MVP, such as collection iterators,
  delays, or human input steps.

## Glossary

### Trigger

The event that starts a workflow: record updated, survey response completed, schedule, manual run, or
webhook.

MVP trigger candidates are Response Received, Response Completed, and Survey Completed. Webhook
Received is a valid future trigger but is not required for the MVP.

### Action

A step that does something: send email, call webhook/API, update record, create task, delay. Actions
have an input and an output, and the output can be structured.

MVP action candidates are Send Email, Send Webhook / API Call, Compute / Calculate, and If/Else
branching. AI Agent is a good MVP stretch action when time allows.

### Condition / Filter

A gate that decides whether execution continues. Example: only if the respondent reached a specific
thank-you card.

### Branch

Multiple paths from one step. Useful for if/else behavior or parallel actions.

### Workflow Definition

The saved source of truth: usually a JSON graph/schema with nodes, edges, configs, variables, and
metadata. A workflow also has workspace-scoped human-facing metadata outside the graph document:
required `name` and optional `description`.

### Workflow Version

An immutable enabled snapshot. Drafts can change, but enabled runs should execute against the
version that was live.

### Workflow Lifecycle / Status

A workflow definition exists in one of three explicit states governed by a small state machine:

- `draft`: editable, never triggers runs.
- `enabled`: responds to trigger events.
- `disabled`: saved but inert; can be re-enabled without losing configuration.

Valid transitions: `draft` -> `enabled`, `enabled` <-> `disabled`, and `enabled` or `disabled` ->
`draft` when the editor needs to make breaking changes. Only `enabled` workflows respond to trigger
events. The state machine is enforced by both the v3 API and the dashboard UI.

### Run / Execution

One concrete workflow execution after a trigger fires. Has status, inputs, outputs, timestamps, and
errors.

### Workflow Run Lifecycle / Status

A workflow run exists in one of five explicit states:

- `queued`: run record exists and is waiting for a worker or a retry attempt.
- `running`: a worker has claimed the run and is executing trigger, condition, branch, or action
  steps.
- `completed`: all required steps finished successfully and the run is terminal.
- `failed`: the run reached a terminal failure because validation, a step, an action, or retry
  exhaustion failed.
- `canceled`: the run was intentionally stopped before completion and is terminal.

Valid MVP transitions: `queued` -> `running`, `running` -> `queued` for retry/backoff,
`queued` -> `canceled`, and `running` -> `completed`, `failed`, or `canceled`. `completed`,
`failed`, and `canceled` are terminal. Retries do not introduce a separate `retrying` status; retry
state is metadata on a `queued` or `running` run.

### Step Input / Output

Data passed into and returned from each step. Later steps reference earlier outputs.

### Variables / Expressions

How users map data into fields, for example `recipient = response.contact.email`. The MVP supports
variable mapping inside structured action configuration (for example, choosing which response field
becomes the email recipient or feeds a Compute step), but does not support user-authored body
templating in Send Webhook / API Call. The MVP webhook body is a fixed JSON envelope whose `response`
property carries the previous action's output (or the trigger payload at the first step).
User-authored body templating with expressions such as `$input.action_id` or `$input.response.score`
is a planned post-MVP capability.

### Idempotency

Protection against duplicate side effects when retries happen, for example not sending the same
email twice.

### Retry Policy

Rules for what happens when a step fails: retry, stop, skip, alert, or manual rerun.

### Queue / Worker

Async execution layer for workflow runs, delays, emails, webhooks, and retries.

### Run Log / Audit Log

Trace of what happened, useful for debugging, compliance, support, and trust.

### Dry Run / Test Run

Safe execution with sample, selected, or manually entered trigger data before activation. The MVP
dashboard should expose a dry-run button that opens a form for simulating the selected trigger
payload. Dry runs validate configuration and execute trigger, condition, branch, and compute logic in
a safe mode. Side-effect actions such as Send Email and Send Webhook / API Call must not perform real
external side effects during dry run unless a later explicit live-test mode is designed.

### Scope / Permissions

Who owns, edits, runs, and manages workflows. For Formbricks, workspace, environment, and
organization scoping is a major decision.

## Business Rules

- Workflows belong to a workspace. One workspace can own many workflows.
- Workflow creation must collect a human-readable name and may collect an optional description before
  opening the builder.
- Workflow data access inherits the same workspace permissions as the source data the workflow uses.
- The workflow creator is expected to have permission to access survey data passed through the
  workflow pipeline.
- The MVP permission granularity is workspace-level. Team-level Read / Write / Manage mapping must be
  defined before implementation if the UI exposes workflow management to teams.
- Workflow definitions are JSON documents and should be schema-validatable.
- Workflow definition schemas should be shared by the dashboard and v3 API. The dashboard validates
  drafts locally for immediate UX feedback, while the API validates the same payload again and remains
  authoritative for persistence, lifecycle transitions, dry runs, and execution.
- Shared workflow schemas must stay client-safe and pure; server-only semantic validation is layered
  on top for permissions, workspace scoping, referenced records, lifecycle authority, webhook URL
  safety, entitlements, and side-effect/idempotency constraints.
- Workflow configuration and workflow run data live separately so definitions, runs, logs, and
  retries can evolve independently.
- Every completed action updates the relevant workflow run data. The final/computed output for each
  action must be saved in the run document.
- Actions should support structured outputs. For MVP, response trigger inputs are known, and computed
  outputs can infer their type from math or string operations, so a full mapper/schema creator is not
  required.
- Webhook/API actions may send user-configured HTTP headers in the MVP. Encrypted header/secret
  storage is not supported in the MVP, so the UI must clearly distinguish plain custom headers from
  secrets that require encrypted storage.
- Workflow runs must be observable through status, logs, elapsed time, failure reason, and relevant
  metadata.
- Workflow runs should be visible both from a specific workflow and from a workspace-level runs page
  that lists runs across workflows.
- Workflow run status must use only `queued`, `running`, `completed`, `failed`, or `canceled` in the
  MVP. Additional states such as retrying or timed out must be represented as retry/failure metadata
  unless a later decision expands the status vocabulary.
- Only workflows in the `enabled` state respond to trigger events. Workflows in `draft` or `disabled`
  states are saved but never produce runs or side effects.
- Disabling a workflow stops new runs but does not delete the definition or its historical runs.
- Lifecycle state transitions are validated by a small explicit state machine implemented in the
  data model and exposed through both v3 API endpoints and the dashboard UI.
- Send Webhook / API Call action bodies in the MVP follow a fixed envelope shape; user-configurable
  body templating with variable expressions is a planned post-MVP capability and must not be added
  without an explicit decision update.
- Dry-run execution must accept simulated trigger data through the API and dashboard, validate the
  workflow configuration, evaluate conditions/branches/compute steps, and expose logs/results without
  producing real external side effects.

## Examples and Edge Cases

- A Follow-up can become a workflow with a response-completed trigger, a thank-you-card condition,
  and a Send Email action to a teammate or to an email from the response.
- A webhook action can call an external endpoint after a survey response is completed and may pass
  configured headers, but the MVP must disclose that those headers are not encrypted secret storage.
- A compute action can transform known trigger data or previous action output, but it must stay within
  constrained math/string operations unless an explicit safe expression runtime is chosen.
- If the same trigger event is delivered twice, idempotency must prevent duplicate side effects such
  as sending the same email twice.
- If a customer has very high survey response volume, workflow triggering may need batching or
  buffering within a time window to avoid overloading cloud workers.

## Source or Rationale

- [E001 Workflows](../epics/E001-workflows.md)
- [001 Workflows MVP](../milestones/001-workflows-mvp.md)
- [001 Workflows API-first backend contract](../decisions/001-workflows-api-first-backend-contract.md)
- [002 Workflows technical architecture](../decisions/002-workflows-tech.md)
- [Architecture diagrams](../../research/docs/diagrams.md) — the lifecycle and run-status state machines in this
  glossary are visualized as diagrams 3 and 5.

## Implementation and Tests

- API tests must cover workspace scoping and permission denial.
- Shared schema tests must cover valid/invalid workflow definitions, trigger/action configs,
  lifecycle values, and dry-run request payloads.
- API and worker tests must cover valid workflow run status values and status transitions.
- Worker tests must cover idempotency, retry policy, and side-effect failure isolation before real
  Send Email or Send Webhook execution ships. The PoC coverage is intentionally narrower and is
  defined in Plan 001-010.
- All delivered TypeScript logic must have automated test coverage through Vitest, API integration
  tests, worker tests, or equivalent package-level tests.
- Do not add TSX/component unit tests for workflow UI. Cover important dashboard behavior with
  Playwright E2E flows and manual QA instead.
- E2E/manual QA must cover workflow definition management, activation, dry runs with simulated
  trigger data, run listing, run details, and clear disclosure of MVP limitations.
- OpenAPI generation must be run when workflow API endpoints are added or changed.

## Change History

- 2026-05-21: Initial glossary and scope rule created from the Linear Workflows project and Javier's
  MVP notes.
