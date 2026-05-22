# 3. Glossary and Statuses

### ⚡️ Trigger

The event that starts a workflow: record updated, survey response completed, schedule, manual run, or
webhook.

The minimal MVP starts with Response Completed. Response Received and Survey Completed remain full
MVP/Beta candidates. Webhook Received is a valid future trigger but is not required for the MVP.

### ▶️ Action

A step that does something: send email, call webhook/API, update record, create task, delay. Actions
have an input and an output, and the output can be structured.

The minimal MVP starts with Send Email, Send Webhook / API Call, and If/Else branching. Compute /
Calculate remains a full MVP/Beta candidate. AI Agent is a later candidate and needs a separate
decision before implementation.

### 🚦 Condition / Filter

A gate that decides whether execution continues. Example: only if the respondent reached a specific
thank-you card.

### 🔀 Branch

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
