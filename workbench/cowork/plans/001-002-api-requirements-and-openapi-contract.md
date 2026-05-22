# Plan: API Requirements and OpenAPI Contract

| Field     | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| Status    | Proposed                                                             |
| Owner     | Javier Aguilar                                                       |
| Milestone | [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md) |

## Goal

Define the v3 API surface required for Workflows before dashboard UI implementation starts.

## Definition of Done

- Endpoint inventory exists for workflow definitions, activation, versions, runs, logs, dry/test runs,
  and available trigger/action metadata.
- Endpoint inventory covers the workflow lifecycle state machine: enable (`draft` -> `enabled`),
  disable (`enabled` -> `disabled`), re-enable (`disabled` -> `enabled`), and return-to-draft
  (`enabled`/`disabled` -> `draft`). State transitions are explicit API operations, not implicit
  side effects of updating the workflow definition.
- Run list/detail schemas and filters use the MVP run status vocabulary: `queued`, `running`,
  `completed`, `failed`, and `canceled`.
- Endpoint inventory covers dry runs with simulated trigger data, including request/response schemas,
  no-send side-effect behavior, logs, and permission checks.
- Every UI operation planned for the MVP has an equivalent v3 API operation.
- Shared client-safe zod schemas are planned for workflow definitions, trigger/action configs,
  lifecycle operations, run filters, and dry-run requests. The dashboard imports these schemas for
  local pre-submit validation; the v3 API imports the same schemas for authoritative request
  validation and OpenAPI generation.
- Server-only semantic validation is separated from pure shared schemas and covers auth, workspace
  scoping, referenced records, lifecycle transition authority, webhook URL safety, entitlements, and
  side-effect/idempotency constraints.
- Authentication, workspace scoping, pagination, validation, and error responses are specified.
- OpenAPI generation requirements are documented.
- Missing API work is split into implementation tasks before UI coding begins.

## Out of Scope

- Implementing the dashboard UI.
- Implementing the full workflow engine.
- Adding non-MVP endpoints for scheduling, webhook-received triggers, collection loops, delays, or
  human input steps.

## Phases

| Phase | Scope                                                   | Acceptance Checks                                                                                                                   | Status   |
| ----- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A     | Inventory user-facing workflow operations.              | Each create/update/list/detail/run operation maps to a v3 API endpoint.                                                             | Proposed |
| B     | Define shared request/response schemas and error model. | Client-safe schemas cover workflow JSON, action configs, trigger configs, activation, runs, logs, pagination, and dry-run requests. | Proposed |
| C     | Define auth and workspace scoping.                      | Permission checks are explicit for read/write/manage behavior and denied access.                                                    | Proposed |
| D     | Plan OpenAPI generation and docs updates under `docs/`. | Required commands and generated files are listed.                                                                                   | Proposed |
| E     | Final review pass.                                      | Endpoint inventory is accepted before UI plan implementation starts.                                                                | Proposed |

## Test and Validation Plan

- API tests for success, validation failures, permission denial, pagination, run status filters, dry
  runs with simulated trigger data, and workspace isolation.
- Every delivered TypeScript API/schema helper must have automated coverage.
- Shared schema tests must cover valid and invalid workflow definitions, node/edge structures,
  trigger/action config payloads, lifecycle operation payloads, and dry-run request payloads.
- API tests must prove the backend rejects invalid payloads even if a client skipped frontend
  validation.
- OpenAPI generation after endpoint implementation:
  - `pnpm --filter @formbricks/web generate-api-specs`
  - Follow existing merge/client endpoint steps from [CHECKS.md](../../blueprint/CHECKS.md).

## Manual QA Impact

Manual QA should verify that the dashboard can complete each workflow operation using the public v3
API path and that API denial cases are reflected clearly in the UI.

## Changelog Impact

Category: Added

Note: Adds a v3 API surface for creating, managing, executing, and inspecting workflows.

## Circuit Breakers

- Stop if any UI-only workflow operation is proposed without an API equivalent.
- Stop if OpenAPI generation cannot represent the workflow JSON schema cleanly.
- Stop if the shared schema module cannot be imported by browser code without pulling in server-only
  dependencies.
- Stop if permission semantics are unclear.

## Risk Notes

- Workflow JSON can become too loose for reliable API generation. Prefer explicit zod schemas and
  versioned schema contracts.
- Duplicating similar-but-not-identical schemas between frontend and backend would create drift. The
  plan should choose one shared pure schema layer and keep server-only validation as an additive layer.

## Architecture Reference

- [research/docs/diagrams.md](../../research/docs/diagrams.md) — the system component map (diagram 1) and the
  create/edit request flow (diagram 2) describe the v3 API position in the architecture and the
  contract this plan must honor.

## Decision-Record Check

- Required by [001 Workflows API-first backend contract](../../blueprint/decisions/001-workflows-api-first-backend-contract.md).
- Stop if a dashboard-only endpoint, Next.js server action, or non-v3 workflow contract is proposed.
  Those are not accepted implementation shortcuts for Workflows.

## Final Review

- Checks run and recorded.
- Workbench docs updated.
- Follow-ups captured.

- [x] Reviewed and refined by: Javier Aguilar
