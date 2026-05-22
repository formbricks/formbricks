# Research: Workflows PoC Prototype Scope

| Field      | Value                                                                      |
| ---------- | -------------------------------------------------------------------------- |
| Status     | Done                                                                       |
| Date       | 2026-05-22                                                                 |
| Source     | [001-000](../../cowork/plans/001-000-prototype-readiness-and-contracts.md) |
| Next input | [001-010](../../cowork/plans/001-010-workflows-poc-vertical-slice.md)      |

## Scope Cut

The PoC is an architecture-faithful demo slice, not the full Workflows MVP/Beta target.

The PoC proves:

- One trigger: `response.completed`, mapped from the existing `responseFinished` response pipeline event.
- One branch node: If/Else.
- Two no-send action previews:
  - Send Email Preview.
  - Send Webhook Preview with fixed envelope `{ response: <previous output or trigger payload> }`.
- Workflow lifecycle subset:
  - Required: `draft` -> `enabled` -> `disabled`.
  - Re-enabling via `disabled` -> `enabled` is useful because it uses the same enable endpoint.
  - Return-to-draft is Beta unless implementation needs it to unblock editing.
- Run lifecycle subset:
  - `queued` -> `running` -> `completed`.
  - `queued` -> `running` -> `failed`.
  - `canceled` is schema-visible but not required in the PoC UI.
- Minimal surfaces:
  - Configured workflows list.
  - Builder canvas driven by workflow JSON.
  - Fixed/collapsible builder drawer.
  - Run list.
  - Run detail.

## Boundaries

The PoC must keep these architecture contracts:

- v3 route handlers are the backend contract.
- The dashboard is a client of the same v3 endpoints.
- No Next.js server actions for Workflows behavior.
- No dashboard-only workflow behavior.
- Shared browser-safe zod schemas validate workflow JSON in the dashboard and API.
- Workflow JSON is the source of truth; React Flow nodes/edges are derived view state.
- Workflow definitions and workflow runs are persisted separately.
- BullMQ under `packages/jobs` executes workflow runs.
- Email and webhook actions produce inspectable previews only. They do not send mail or perform outbound HTTP.

## Explicit Deferrals

The PoC intentionally defers:

- OpenAPI generation and complete API documentation polish.
- Dry-run endpoint/UI.
- Audit logs.
- Version snapshots, rollback, and immutable enabled versions.
- Real Send Email and Send Webhook side effects.
- Idempotency keys, retries, backoff, batching, worker topology, and production concurrency.
- Compute, AI Agent, scheduling, loops, delays, human input, and webhook-received triggers.
- Existing Follow-ups/Webhooks migration or no-regression guarantees.
- Playwright E2E and i18n validation.

## Imported Prototype Review

Reference folder: `workbench/research/workflows-proto-logic/`.

Reusable ideas:

- `workflows/schema.ts` demonstrates a compact zod-first workflow contract.
- `workflows/actions-registry.ts` separates action descriptors from workflow documents.
- `workflows/trigger-output.ts` models trigger output leaves and type-aware operators.
- `workflows/validate.ts` returns path-addressable validation issues that can map cleanly to a drawer UI.
- `workflows/ai-manifest.ts` shows how schemas/descriptors can later become an AI authoring manifest.
- `state/editor.ts` keeps draft, selected step, dirty state, and validation issues outside persisted data.

Required renames before any code promotion:

- Prototype trigger `survey.response.created` becomes PoC trigger `response.completed`.
- Prototype event concept maps to existing pipeline event `responseFinished`.
- Prototype status `enabled` remains the lifecycle status.
- Prototype flat `conditions/actions` shape becomes graph/source-of-truth workflow JSON with explicit nodes and edges.
- Prototype Slack action is not in the PoC; use Send Email Preview and Send Webhook Preview.

Known gaps:

- Prototype has no workspace scoping, v3 API contract, Prisma model split, BullMQ run execution, or run records.
- Prototype validation is useful but not sufficient for server-only semantic checks.
- Prototype string templating (`{{path}}`) is useful later, but the PoC webhook body remains the fixed envelope.
- Prototype uses local editor state as the product shape more than the accepted architecture allows. In the PoC,
  editor state must remain view state only.

## Review Conclusion

Plan 001-000 resolves the missing contracts enough for 001-010 to start after human review. The next coding
plan should implement the smallest API-first happy path and avoid pulling deferred Beta contracts forward.
