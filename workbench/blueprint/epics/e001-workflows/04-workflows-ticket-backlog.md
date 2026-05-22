# Workflows Ticket Backlog

Source project: [Linear Workflows](https://linear.app/formbricks/project/workflows-ce94b3bbc18e/overview)

Estimates are implementation effort in developer-days. Linear cycles are one week.

Status note: Foundation and Working Proof of Concept are already covered by the current workbench
records and the PoC checkpoint. Use those sections for history/backfill only. New Linear tickets
should start from PoC review, Beta scope selection, and the remaining MVP/Beta work.

## Foundation

- **Define MVP success criteria** — Decide which Linear success criteria ship in the MVP and which move to Beta. Est: 1d.
- **Research Twenty workflow architecture** — Summarize what to borrow from Twenty's React / BullMQ / Jotai / Postgres direction and what not to copy. Est: 1d.
- **Write refined Workflows concept** — Produce the team-readable bullets for product, engineering, and rollout direction. Est: 0.5d.
- **Decide API-first workflow contract** — Record that dashboard behavior must use the same v3 API as external clients. Est: 0.5d.
- **Define workflow schema boundaries** — Choose shared browser-safe schemas, server semantic validation, and JSON source-of-truth rules. Est: 1d.
- **Plan data model and run model** — Define Workflow vs WorkflowRun persistence, workspace scoping, statuses, and run log shape. Est: 1d.
- **Plan execution architecture** — Decide BullMQ job ownership, response-pipeline hook points, worker behavior, and non-blocking execution. Est: 1d.
- **Plan security and abuse controls** — Capture workspace auth, webhook URL safety, email abuse, dry-run safety, and idempotency needs. Est: 1d.

## Working Proof of Concept

- **Add shared PoC workflow schemas** — Create browser-safe schemas for the PoC trigger, branch, preview actions, statuses, and run data. Est: 1d.
- **Add Workflow and WorkflowRun persistence** — Add migrations and Prisma models with separate definition/run records. Est: 1d.
- **Implement minimal workflow services** — Add workspace-scoped CRUD, lifecycle validation, and run reads. Est: 1d.
- **Implement minimal v3 workflow API** — Add workflow CRUD, enable/disable, run list, and run detail endpoints. Est: 1.5d.
- **Hook Response Completed trigger server-side** — Match enabled workflows after validated response context and enqueue runs. Est: 1d.
- **Add BullMQ workflow run job** — Add producer, processor, job schema, fallback processor, and app override. Est: 1d.
- **Implement PoC graph executor** — Execute trigger -> If/Else -> no-send Email / Webhook preview outputs. Est: 1d.
- **Build minimal dashboard PoC** — Add sidebar, workflow list, builder, config drawer, run list, and run detail using v3 API. Est: 2d.
- **Add focused PoC tests and checkpoint** — Cover schemas, API, execution, worker transitions, trigger matching, and manual demo notes. Est: 1.5d.

## MVP Part 1: Builder

- **Design builder interaction model** — Define add/delete/reconnect/select behavior, drawer layout, validation display, and lifecycle affordances. Est: 1d.
- **Add node palette and node creation** — Users can add all MVP node types from a controlled palette. Est: 2d.
- **Add node deletion and graph repair rules** — Users can remove nodes safely with predictable edge cleanup and validation errors. Est: 1.5d.
- **Add edge editing and branch labeling** — Users can connect nodes and configure branch semantics without invalid saved state. Est: 2d.
- **Implement Response Completed trigger config** — Configure survey scope and trigger metadata with schema-backed validation. Est: 1d.
- **Implement If/Else condition config** — Configure thank-you-card and response-data conditions needed to replace Follow-ups. Est: 2d.
- **Implement Send Email config UI** — Configure recipient from team email or response data, subject, body, reply-to, and metadata. Est: 2d.
- **Implement Send Webhook / API config UI** — Configure URL, method, headers, and fixed MVP body envelope preview. Est: 2d.
- **Add workflow title, duplicate, delete, and list refinements** — Align Workflows list/editor behavior with survey management patterns. Est: 1.5d.
- **Add builder validation UX** — Show schema and semantic errors before save, enable, and dry run. Est: 2d.
- **Add dry-run dashboard flow** — Let users simulate trigger data and inspect execution without real side effects. Est: 2d.
- **Add builder Playwright smoke coverage** — Cover create/edit/delete nodes, save, enable/disable, and dry-run basics. Est: 2d.

## MVP Part 2: Infrastructure & Connectors

- **Implement real Send Email action** — Send workflow emails through existing email infrastructure with no duplicate sends on retry. Est: 2d.
- **Implement email recipient resolution** — Resolve team recipients and response-data recipients with validation and clear failures. Est: 1.5d.
- **Implement real Webhook / API action** — Execute outbound HTTP calls with timeout, response capture, and failure handling. Est: 2d.
- **Add webhook header and URL safety validation** — Validate unsafe URLs, private network risks, plain headers, and future secret-storage limits. Est: 2d.
- **Add idempotency for side effects** — Prevent duplicate email/webhook delivery across retries and duplicated trigger events. Est: 2d.
- **Add retry/backoff policy** — Define retryable failures, attempts, backoff, terminal failure, and run metadata. Est: 2d.
- **Harden run logs and run detail** — Persist step status, input/output summaries, timings, attempts, and failure reasons. Est: 2d.
- **Add workflow version snapshots** — Ensure enabled runs execute against the version that was live when queued. Est: 2d.
- **Harden response-pipeline integration** — Keep workflow enqueue from blocking or breaking legacy response side effects. Est: 1.5d.
- **Add operational checks** — Add queue observability, worker failure tests, and local/self-host setup notes. Est: 1.5d.
- **Evaluate Follow-ups migration path** — Decide whether MVP migrates existing Follow-ups or ships Workflows alongside them. Est: 1d.

## Polishing

- **Polish Workflows IA and navigation** — Finalize sidebar placement, page titles, breadcrumbs, tabs, and empty states. Est: 1d.
- **Polish canvas visual design** — Improve grid, snapping, auto-layout, drawer ergonomics, responsive desktop behavior, and icons. Est: 2d.
- **Polish copy and i18n** — Add final user-facing copy, translations, validation messages, and limitation disclosures. Est: 1.5d.
- **Generate and review OpenAPI docs** — Add workflow endpoints to public API docs and verify dashboard parity. Est: 2d.
- **Expand permission and auth tests** — Cover read/write/manage rules, workspace scoping, and denied access. Est: 1.5d.
- **Add full Playwright MVP paths** — Cover workflow create/edit, dry run, enable, real email/webhook mocked execution, and run detail. Est: 2d.
- **Run self-hosting upgrade review** — Verify migrations, env vars, Redis/worker assumptions, and rollback notes. Est: 1d.
- **Product review and UX fixes** — Triage Workflows team feedback and apply focused fixes before Beta. Est: 2d.

## Internal Rollout / Dogfooding

- **Prepare internal dogfooding workspace** — Set up realistic surveys, response examples, team recipients, and webhook/API test endpoints. Est: 1d.
- **Dogfood Follow-ups replacement flow** — Rebuild representative Follow-ups as workflows and record UX, API, and execution gaps. Est: 1d.
- **Dogfood webhook/API flow** — Exercise real webhook/API calls against controlled endpoints and inspect run logs/failures. Est: 1d.
- **Collect internal feedback and release blockers** — Summarize what confused users, what broke, and what must be fixed before beta. Est: 1d.
- **Convert dogfooding findings into beta tickets** — Move only release-blocking or high-confidence fixes into Beta Release - Ready. Est: 0.5d.

## Beta Release - Ready

- **Beta blocker triage** — Collect, prioritize, and assign all release-blocking bugs. Est: 0.5d.
- **Beta bugfix buffer** — Reserve milestone capacity for verified bugs found during QA and internal testing. Est: 3-5d.
- **Security review fixes** — Resolve SSRF, abuse, permissions, email, webhook, and data exposure findings. Est: 2-4d.
- **Release documentation** — Write beta limitations, setup notes, migration notes, and known issues. Est: 1.5d.
- **Support and demo handoff** — Prepare internal demo script, support notes, and escalation paths. Est: 1d.
- **Final beta go/no-go checklist** — Confirm checks, manual QA, OpenAPI, docs, migrations, and rollout status. Est: 0.5d.

## Assumptions

- The MVP is Follow-ups replacement plus Webhook / API Call, not a general automation platform.
- Natural-language creation, MCP UX, AI Agent, scheduling, loops, delays, and arbitrary third-party integration actions are Beta-or-later.
- These files are a Linear planning export, separate from the canonical workbench epic and milestone records.
- This pass creates Markdown docs only. It does not create Linear milestones or issues.
