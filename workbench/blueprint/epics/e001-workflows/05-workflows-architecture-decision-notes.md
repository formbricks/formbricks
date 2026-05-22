# Workflows Architecture Decision Notes

Source project: [Linear Workflows](https://linear.app/formbricks/project/workflows-ce94b3bbc18e/overview)

These notes summarize the architecture decisions behind the Workflows MVP and Beta path. They are written for Linear planning and team review. The canonical decision records remain in `workbench/blueprint/decisions/`, the business rules in `workbench/blueprint/business-rules/`, and the implementation plans in `workbench/cowork/`.

## 1. Dashboard Uses The Same v3 API As External Clients

Decision: workflow management is API-first. The dashboard must call the same v3 API that external users, LLMs, and future MCP clients can call.

This means workflow create, read, update, delete, enable, disable, dry run, and run inspection must not be implemented as dashboard-only server actions. The UI can have convenience components, but product behavior lives behind v3 route handlers and shared request/response schemas.

The PoC already follows this direction with minimal v3 workflow endpoints. Beta work needs to complete the endpoint contract, pagination, error shape, OpenAPI generation, and public docs.

## 2. Workflow JSON Is The Source Of Truth

Decision: a workflow definition is a schema-validated JSON document. React Flow is an editor view derived from that document, not the persisted source of truth.

This avoids repeating the survey editor problem where UI state and product logic become hard to separate. The saved workflow document owns nodes, edges, configs, and metadata. React Flow can render and edit that graph, but drag positions and config changes must be committed back into workflow JSON.

The PoC validated this with a React Flow builder derived from workflow JSON. Beta work should preserve that model as node configuration grows.

## 3. Shared Schemas Stay Browser-Safe

Decision: workflow schemas are shared between the dashboard and the API, so they must be usable in browser code.

Shared schemas can define workflow JSON shape, node types, action configs, trigger configs, lifecycle statuses, run statuses, and dry-run request shapes. They must not import Prisma, database services, auth helpers, environment variables, filesystem APIs, or other server-only modules.

Server-only validation is layered on top of shared schemas. That server layer checks permissions, workspace scoping, referenced surveys/responses/contacts, lifecycle transitions, webhook URL safety, entitlements, and side-effect/idempotency rules.

## 4. Workflow Definitions And Runs Are Separate Records

Decision: workflow configuration and workflow execution history are stored separately.

`Workflow` is the saved definition and human-facing metadata, such as name, description, status, workspace, and workflow JSON. `WorkflowRun` is one execution, with trigger input, step outputs, logs/status, timestamps, failure reason, and workflow summary data needed for run inspection.

This keeps mutable definitions separate from append-heavy execution data. It also lets the run table grow, paginate, and retain historical debug information without bloating the workflow definition record.

The PoC already uses separate `Workflow` and `WorkflowRun` persistence. Beta should add the indexes, retention rules, and version snapshot behavior needed for production volume.

## 5. Workflows Are Workspace-Scoped

Decision: workflows belong to one workspace and inherit workspace data access rules.

A workflow can read and act on data that the owning workspace is allowed to access. Cross-workspace workflows, organization-wide workflows that bypass workspace permissions, and runs that inspect another workspace's response data are out of scope.

Before Beta, the permission matrix needs to be explicit: who can create, edit, enable, disable, delete, dry-run, and inspect workflow runs. Team-level Read / Write / Manage behavior must be defined if workflows are exposed to teams.

## 6. Workflow Lifecycle Uses Three States

Decision: workflow definitions use a small lifecycle state machine:

- `draft`: editable and never produces runs.
- `enabled`: listens for trigger events and can produce runs.
- `disabled`: saved but inert; can be re-enabled.

Only `enabled` workflows respond to trigger events. Disabling a workflow stops new runs but keeps the definition and historical runs.

The PoC exercises `draft` -> `enabled` -> `disabled`. Beta should decide whether editing a disabled workflow remains allowed or whether breaking edits require an explicit return-to-draft transition.

## 7. Workflow Runs Use One Status Vocabulary

Decision: workflow runs use these statuses:

- `queued`: created and waiting for a worker or retry attempt.
- `running`: claimed by a worker and executing.
- `completed`: finished successfully.
- `failed`: terminal failure.
- `canceled`: intentionally stopped before completion.

Retries and timeouts should be metadata on `queued`, `running`, or `failed`, not separate MVP statuses such as `retrying` or `timed_out`. This keeps run state simple and makes run filtering easier.

The PoC uses the same status vocabulary but only exercises the minimal happy path and failure path.

## 8. Execution Runs Asynchronously Through BullMQ

Decision: workflow execution must not run inside the response submission request.

When a response is completed, Formbricks should validate and save/process the response, match enabled workflows, enqueue workflow runs, and return normally. A BullMQ worker in `packages/jobs` then executes conditions, actions, logs, and side effects.

This protects the response pipeline from email latency, webhook latency, retries, external API failures, and workflow bugs. Response submission should not wait for a workflow to finish.

The PoC already uses BullMQ execution for workflow runs. Beta must add production retry policy, idempotency, timeout handling, worker concurrency defaults, queue observability, and throttling/rate-limit decisions.

## 9. Response Completed Trigger Is Server-Side

Decision: the initial trigger path is server-side matching after the response pipeline has validated workspace and survey context.

For the Response Completed trigger, the dashboard or an external client should not call a public "trigger workflow now" endpoint as part of normal response submission. The response pipeline calls the workflow matcher internally, and the matcher enqueues runs for enabled workflows in the same workspace.

This keeps trigger authorization tied to the response pipeline and avoids exposing a trigger endpoint before its security model is clear.

## 10. MVP Actions Start With Email And Webhook/API

Decision: the first useful production actions are Send Email and Send Webhook / API Call.

The MVP should prove Follow-ups as workflows: trigger on completed responses, branch on the Thank You card reached or response data, then send email or call a webhook/API.

The PoC uses no-send preview versions of both actions. Production Send Email and Send Webhook / API Call must not ship until idempotency, retries, timeouts, failure visibility, abuse controls, and sensitive data handling are defined.

Compute / Calculate is a useful full MVP/Beta candidate, but it needs a constrained expression model and must not become arbitrary code execution.

## 11. Webhook/API Body Shape Is Fixed For MVP

Decision: the MVP Send Webhook / API Call action uses a fixed JSON envelope instead of user-authored body templating.

The expected MVP shape is a standard envelope where `response` carries the trigger payload or previous action output. User-authored body templates and expressions such as `$input.response.score` are post-MVP.

This keeps the first webhook/API action understandable, easier to document, and safer to validate. The action contract should still leave room for templating later without breaking existing workflows.

## 12. Webhook Headers Are Plain Configuration In MVP

Decision: custom webhook/API headers may be useful in the MVP, but encrypted secret storage is not part of the MVP.

If custom headers are exposed, the UI must clearly explain that they are stored as plain workflow configuration and should not be used for secrets. Secret storage for API keys, bearer tokens, and sensitive headers needs a separate design before it ships.

This is a product and security concern, not only an implementation detail.

## 13. Dry Runs Must Suppress Real Side Effects

Decision: dry runs should validate and execute workflow logic safely with simulated trigger data.

A useful dry run should validate the workflow definition, evaluate conditions and branches, run compute-like logic if present, and show step outputs/logs. It must not send real emails or call real webhooks/API endpoints unless a later explicit live-test mode is designed.

The PoC does not include dry-run UI or API. Beta should add dry runs before users can trust production side effects.

## 14. Run Detail Prioritizes Debugging Over Polish

Decision: run list and run detail are required product surfaces, not optional admin tooling.

Users need to understand what happened after a workflow ran: trigger input summary, branch decisions, action outputs, timestamps, duration, status, and failure reason. For the MVP, JSON dumps are acceptable if they are scoped, readable, and do not expose data outside workspace permissions.

Beta should define what sensitive values are masked or omitted from logs, especially webhook headers, request bodies, response data, and external API errors.

## 15. Version Snapshots Are Needed Before Real Side Effects

Decision: enabled workflow runs should execute against the version that was live when the run was queued.

Full rollback UI is not required for the MVP, but internal version snapshot readiness matters before real email/webhook side effects ship. Without snapshots, a user could edit a workflow while queued runs are still executing and make run behavior hard to explain.

The PoC stores only the current workflow definition. Beta must decide the minimum snapshot behavior before production side effects are enabled.

## 16. Existing Follow-Ups And Webhooks Stay Untouched Until Migration Is Decided

Decision: the MVP can prove Follow-ups and webhook-style automation as workflows without immediately deleting or migrating the existing features.

Existing Follow-ups, Webhooks, and integrations must keep working while Workflows is built. A migration or replacement path needs separate product review, no-regression QA, and support guidance.

The open question is whether Beta replaces existing Follow-ups, ships Workflows alongside them, or only validates the replacement path first.

## 17. Existing Integrations Are Future Workflow Actions, Not MVP Scope

Decision: existing connectors such as Slack, Notion, HubSpot, Airtable, Google Sheets, and other integration modules are not exposed as workflow actions in the MVP.

The action interface should not block wrapping them later, but the first MVP should stay focused on Send Email and Send Webhook / API Call. Broad connector actions would expand the product and QA surface too early.

## 18. Builder State Is Scoped To The Workflow Editor

Decision: the PoC builder uses scoped Jotai plus Immer for editor-local state, not a new app-wide state management convention.

This state owns local editing concerns such as selected node, drawer state, draft workflow JSON, and derived React Flow nodes. The v3 API remains authoritative for persisted workflow state.

React Hook Form and TanStack Query are optional Beta tools. They should be added only if they reduce real complexity in node config forms, server-state caching, pagination, polling, or mutation invalidation.

## 19. PoC Is Architecture-Faithful But Not Production-Complete

Decision: the PoC validates architecture, not production readiness.

The PoC proves the load-bearing choices: v3 API, shared schemas, workflow JSON as source of truth, React Flow editor projection, separate definition/run records, BullMQ execution, server-side Response Completed matching, and no-send action previews.

It intentionally defers OpenAPI generation, dry runs, audit logs, idempotency, retries, production worker topology, version snapshots, Playwright E2E, real side effects, and migration of existing Follow-ups/Webhooks.

## 20. Beta Must Start From PoC Feedback

Decision: the next planning step is not "finish every old plan in order." It is to review the PoC checkpoint, identify which shortcuts caused real problems, and choose the Beta scope.

The full workbench plans remain useful, but the Beta backlog should be shaped by evidence from the PoC demo, internal review, and any customer/team feedback. This prevents over-building production plumbing that the first product slice may not need yet.

## Source Workbench Records

- `workbench/blueprint/decisions/001-workflows-api-first-backend-contract.md`
- `workbench/blueprint/decisions/002-workflows-tech.md`
- `workbench/blueprint/decisions/003-workflows-mvp-is-proof-of-concept.md`
- `workbench/blueprint/decisions/004-workflows-builder-state-management.md`
- `workbench/blueprint/business-rules/001-workflows-glossary-and-scope.md`
- `workbench/blueprint/milestones/001-workflows-mvp.md`
- `workbench/cowork/checkpoints/001-010-workflows-poc-vertical-slice.md`
- `workbench/linear-docs/02-workflows-refined-concept.md`
- `workbench/linear-docs/03-workflows-milestones.md`
- `workbench/linear-docs/04-workflows-ticket-backlog.md`
