# Workflows Milestones

Source project: [Linear Workflows](https://linear.app/formbricks/project/workflows-ce94b3bbc18e/overview)

Status note: Foundation and Working Proof of Concept are already represented in the current
workbench records. The PoC vertical slice is implemented and checkpointed. The remaining planning
work should start from PoC review and Beta scope selection, not from rebuilding Foundation or PoC.

## Overall Estimate

- 1 developer: 15-19 one-week cycles.
- 2 developers: 9-12 one-week cycles.
- AI-assisted delivery target: 8-10 one-week cycles with 1 developer, or 5-7 one-week cycles with 2 developers, assuming scope stays tight and review cycles are fast.
- Assumption: one primary full-stack owner, with an optional second developer splitting UI and API / worker work after Foundation.
- Estimates include planning, implementation, focused tests, review fixes, and workbench documentation, but not large unexpected product redesigns.

## 1. Foundation

Establish the product, architecture, and implementation contract before building user-facing workflows. This milestone defines which Linear success criteria belong in the MVP, which move to Beta or later, and which constraints are required for a useful first release.

Foundation also covers the Twenty research pass, the API-first backend contract, workflow JSON as source of truth, schema boundaries, data/run model, execution model, security concerns, and the initial refined concept for team review.

The output should make the project clear enough that implementation agents do not invent private dashboard behavior, collapse definitions and runs into one record, or block response submission on workflow execution.

Estimate: 2-3 cycles with 1 developer, 1-2 cycles with 2 developers.

## 2. Working Proof of Concept

Ship an architecture-aligned vertical slice with intentionally minimal behavior. The PoC proves Response Completed trigger matching, If/Else path selection, no-send email and webhook previews, v3 API access, BullMQ execution, separate run persistence, run list/detail, and a React Flow builder.

This milestone does not ship full production side effects. Its purpose is to validate that the core product architecture can support the real MVP without coupling workflows to dashboard-only behavior or synchronous response pipeline work.

The PoC should be demoable in the dashboard and usable from external clients through the same v3 API contracts the dashboard calls.

Estimate: 2-3 cycles with 1 developer, 1-2 cycles with 2 developers.

## 3. MVP Part 1: Builder

Turn the PoC builder into a real workflow editor. Users should be able to create, edit, delete, configure, validate, and save all MVP node types and metadata without needing hand-authored JSON.

The builder covers node UX, graph editing, schema validation feedback, workflow lifecycle controls, dry-run entry points, list/detail ergonomics, and the core reusable components that make later nodes possible.

The implementation should keep workflow JSON as the source of truth. React Flow state is derived editor state, not a second persisted graph model.

Estimate: 4-5 cycles with 1 developer, 2-3 cycles with 2 developers.

## 4. MVP Part 2: Infrastructure & Connectors

Replace preview actions with production-ready Send Email and Send Webhook / API Call execution. This milestone is where workflows become useful beyond a visual builder.

The work must include idempotency, retries, timeout handling, dry-run side-effect suppression, webhook safety validation, run observability, and safe response-pipeline integration. Email and webhook behavior should be debuggable from run detail without exposing sensitive data unnecessarily.

This milestone also decides whether existing Follow-ups migrate into workflows during MVP or remain alongside workflows until Beta.

Estimate: 4-5 cycles with 1 developer, 3 cycles with 2 developers.

## 5. Polishing

Finish the release work that did not fit cleanly into the MVP milestones. This includes UI refinement, empty/loading/error states, copy and i18n, API docs and OpenAPI, permission-denial coverage, Playwright E2E, migration review, self-hosting notes, and product review fixes.

Polishing should focus on release confidence rather than expanding scope. New major capabilities discovered during review should move to Beta unless they block the Follow-ups replacement use case.

The milestone should leave the team with stable docs, reproducible QA steps, and clear known limitations.

Estimate: 2-3 cycles with 1 developer, 1-2 cycles with 2 developers.

## 6. Internal Rollout / Dogfooding

Use the feature internally before calling it beta-ready. This milestone validates that real Formbricks usage can create workflows, debug runs, understand failures, and trust dry runs without engineering help.

Dogfooding should use realistic survey responses, team email routing, webhook/API test endpoints, and the same dashboard/API paths intended for customers. The goal is to turn internal feedback into concrete release blockers or focused fix tickets, not to expand product scope.

The milestone should end with a short dogfooding report: what worked, what confused users, what broke, and which issues must move into Beta Release - Ready.

Estimate: 1 cycle with either team size.

## 7. Beta Release - Ready

Placeholder milestone for release blockers, QA bugs, security review fixes, beta docs, support handoff, and final go/no-go tasks.

This milestone should stay flexible. It covers the work that only becomes visible after internal testing, product review, and early beta feedback.

Do not add new major scope here unless it is required for a responsible beta release.

Estimate: 1-2 cycles for either team size, depending on bug volume.
