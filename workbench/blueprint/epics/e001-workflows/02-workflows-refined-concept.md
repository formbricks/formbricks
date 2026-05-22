# 2. Concept and Scope

---

**Status**: Draft

**Proposed by**: Javi Aguilar

---

This document turns the long Workflows project brief into the product and engineering concept we should build against first.

It frames the minimal MVP scope, the boundaries we should protect, and the architecture principles that keep Workflows usable from the API, dashboard, and future agent-driven clients.

The focus is: survey responses, conditions, emails, webhooks, runs, and debugging.

## Concept

- Workflows are Formbricks' Action & Automation layer for XM: trigger on feedback events, branch on response data, and run scoped actions such as email or webhooks (and more later).
- The MVP should prove Follow-ups as workflows: Response Completed trigger, Thank You card reached or response data conditions, Send Email action, and Send Webhook / API Call action.
- Branching: conditions can be applied to the response payload, comparing values with typical operations (greater than, string contains, equals, etc.) that we already have for survey conditions. Still need to decide how far we want to go on this.
- The core design choice is API-first workflows as structured data (JSON docs): the dashboard, external API users, LLMs, and future MCP clients all use the same schema-backed contract.
- Every Workflow JSON document is the source of truth; the builder UI is only an editing projection.
- Workflow execution is async through BullMQ and `packages/jobs`; response submission must not block on email or webhook latency.
- Workflow definitions and workflow runs are separate records; runs should persist inputs, outputs, logs, status, and failure reasons. Definitions are just the config.
- Workflows are scoped to one workspace and inherit workspace permissions. Cross-workspace reads, writes, and runs are out of scope.
- The MVP includes API-first design (in terms of workflow schema and backend API contract), builder extension points, run observability, dry runs, real email, and webhook / API call.
- The MVP postpones AI-assisted workflow creation, MCP UX, scheduling, AI Agent action, loops, delays, versioning (full version rollback UI), and third-party integration actions.
- Beta work decides how far to go on audit logs, version snapshots, migration from existing Follow-ups, self-hosting docs, abuse controls, and connector fixes.

This is the general concept for the minimal MVP path that would lead us to the first Beta release, not a Proof of Concept spec. The Proof of Concept is the first implementation milestone that proves the architecture with minimal behavior. The broader workbench plans still track full MVP/Beta candidates such as Compute, extra triggers, OpenAPI, audit logs, and production hardening.

## MVP Success Criteria

- A workspace admin can create, edit, enable, disable, duplicate, and delete workflows through the dashboard.
- The same workflow operations are available through the v3 API; the operations do not use Next.js server-actions. All that can be done from the UI should be also doable via the API.
- A Response Completed trigger can start a workflow after the response pipeline has validated workspace and survey context.
- Conditions can branch on the response payload, including the Follow-ups replacement case of matching Thank You / response data. Still up to decide what other conditions we bake in the MVP.
- Send Email can send to a teammate or to an email value from the response, with no duplicate sends on retries.
- Send Webhook / API Call can call an external endpoint with a fixed MVP request envelope and inspectable run output.
- Dry runs let users test the workflow with simulated trigger data and inspect logs without real side effects. This would be also very useful for us to quickly QA/test the features. It adds complexity but worth the effort.
- Run list and run detail make executions debuggable enough that users can understand what happened. For the MVP it is enough to show JSON dumps.

## MVP Scope (minimal)

- ⚡️ Triggers: Response Completed trigger.
- 🚦 Conditions: Thank You / response-data condition.
- ▶️ Action: Send Email to a teammate or an email from the response.
- ▶️ Action: Send Webhook / API Call.
- API-first workflow CRUD, lifecycle, dry run, and run inspection.
- React Flow builder derived from our workflow JSON documents.
- Async BullMQ execution via `packages/jobs`.
- Separate workflow definition and workflow runs persistence.
- Runs list, run detail, logs, statuses, and failure reasons.
- Internal rollout / dogfooding before beta release.

## Not in MVP

- Natural-language workflow creation and editing (LLMs).
- MCP-specific workflow management UX.
- AI Agent action.
- Schedules, loops, delays, human approval steps (e.g. a form to fill), and webhook-received triggers.
- Full UI for versioning and rollbacks, beyond internal readiness for immutable enabled snapshots.
- Arbitrary third-party integration actions (e.g. send to Linear, or create a contact, or an entry in Twenty).
- User-authored webhook body templating (e.g. using values from the previous action data to build the webhook payload) and secret storage for custom headers.
- Full "Follow-ups" migration unless the MVP behavior has shown it is stable.

## For a Beta / Later

- Version snapshot UI and rollback.
- Audit log hardening (e.g. who edited a workflow and what was changed).
- Secret storage for webhook headers.
- User-authored webhook body templating.
- Follow-ups feature migration.
- Abuse and rate-limit hardening.
- Self-hosting docs and operational setup.
- Natural-language and MCP workflow management.
- AI Agent, scheduling, loops, delays, and broader connector actions.

## Architecture Principles

- Keep workflows workspace-scoped.
- Keep workflow JSON as the source of truth.
- Keep shared schemas browser-safe (should be usable without server-specific code).
- Keep server-only semantic validation layered on top of shared schemas.
- Keep validation in the UI for early UI feedback before sending it to the API (which should also validate)
- Keep workflow definition persistence separate from workflow run persistence.
- Keep execution out of the response request path (submitting survey responses should not wait for workflows to finish).
- Keep real side effects behind idempotency, retry, timeout, and observability controls.

## Tech Decisions and References

Twenty is useful as a reference for workflow UI and execution architecture, but we should not copy its CRM-specific assumptions or object model. Typeform is also worth checking.

Javi's trial-day prototype is useful input too: [https://github.com/itsjavi/formbricks-workflows](https://github.com/itsjavi/formbricks-workflows). It already explores schema-first workflow definitions and AI-assisted workflow creation.

For implementation, the chosen direction is:

- React and Next.js for the dashboard UI, but without Next.js server actions as the workflow backend contract. RSCs are allowed.
- React Flow (xyflow) for the workflow canvas [https://reactflow.dev/examples/nodes/custom-node](https://reactflow.dev/examples/nodes/custom-node)
- Jotai + Immer + local React state for builder-local draft/editor state. This is scoped to the workflow builder, not an app-wide state management rule.
- BullMQ + redis/valkey for async workflow execution. Easy choice since we already use it.
- Zod for schema validation.
- Existing design system for the UI (tailwind, shadcn)
- PostgreSQL for workflow definitions and run records.

## Risks, Concerns, And Questions

- The MVP scope may still be too broad if real email, outbound webhooks, dry runs, run observability, idempotency, retries, and builder UX all need to ship before beta.
- Send Email action and Email spamming: It is a risk now with the Follow-ups feature and it transfers to the workflows. Our domain can get penalized or blocked from AWS SES if they detect abuse and we don't have measures in place (rate limiting, bounce detection etc.).
  - We probably shouldn't allow our customers to run "marketing campaigns" with this feature by sending automated emails to the survey responders
  - A good first measure could be that we only allow to send mails to verified email addresses
  - From a product perspective I don't know if this can be done or will make users unhappy
- The PoC proves the architecture, but it does not prove production side effects. Real Send Email and Send Webhook / API Call still need timeout handling, retry behavior, idempotency, abuse controls, and clear failure states.
- Follow-ups migration is still a product decision. We need to decide whether the MVP replaces existing Follow-ups, ships alongside them, or only proves the replacement path before migration.
- Webhook/API custom headers are useful, but secret storage is not planned for the MVP. We need clear UI warning/copy and engineering/product agreement on what is safe to store as plain configuration.
- Workflow versioning is needed for safe enabled runs, but full rollback UI is not planned for the MVP.
- Dry runs are important for user trust, but they can become a large feature. We need to define the smallest useful dry-run flow: simulated trigger payload, branch decisions, validation errors, and no-send action previews.
- Workspace permissions need a precise rule before beta. We need to confirm who can create, edit, enable, disable, delete, and inspect workflow runs, especially with team-level permissions.
- High-volume surveys may create many workflow runs. We need to decide whether MVP execution needs batching, rate limits, backpressure (throttling, queue size, fail-fasts, etc), or only basic queue controls.
- Run logs must help users debug failures without exposing sensitive response data unnecessarily. We need to decide what inputs, outputs, headers, payloads, and errors are visible in run detail.
- The builder can become as complex as the survey editor if workflow JSON, React Flow state, drawer forms, and validation are not kept clearly separated.
- API-first is a core requirement. OpenAPI generation and public API docs are not required for the PoC, but they are required before Beta/public API readiness. We need to decide exactly when to do this.
- AI-assisted workflow creation, MCP UX, AI Agent actions, schedules, loops, delays, and broad connector actions are not in the MVP. We need to keep them visible as future direction without letting them shape the first builder too much.
- Existing Webhooks and integrations must keep working. Any workflow trigger hook in the response pipeline must not block or break existing Integrations.
- Self-hosted deployments need clear worker, Redis, migration, and upgrade expectations before beta. We need to decide how much operational documentation is required for the first public release.
- The AI Agent action from Twenty was very interesting and something that we may want to integrate, even though that would produce extra costs (LLM tokens) that could escalate quickly without proper control.
