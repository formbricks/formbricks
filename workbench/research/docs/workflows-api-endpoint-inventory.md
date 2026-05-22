# Research: Workflows API Endpoint Inventory

| Field      | Value                                                                      |
| ---------- | -------------------------------------------------------------------------- |
| Status     | Done                                                                       |
| Date       | 2026-05-22                                                                 |
| Source     | [001-000](../../cowork/plans/001-000-prototype-readiness-and-contracts.md) |
| Next input | [001-010](../../cowork/plans/001-010-workflows-poc-vertical-slice.md)      |

## Existing v3 Patterns To Reuse

- Route handlers live under `apps/web/app/api/v3`.
- `withV3ApiWrapper` handles auth modes, request IDs, zod body/query/params validation, rate limiting,
  RFC 9457 problem responses, success envelopes, and optional audit log wiring.
- `requireV3WorkspaceAccess` supports session and API-key auth with workspace-scoped `read`, `readWrite`,
  or `manage` checks.
- List responses use `{ data, meta }`; item responses use `{ data }`.
- Validation errors return `400` with `invalid_params`.
- Existence-sensitive resources should return generic `403` instead of leaking `404`.

## PoC HTTP Endpoints

| Method   | Path                                          | Auth                          | PoC status | Request shape                                                      | Response shape                                  | Notes                                                                                            |
| -------- | --------------------------------------------- | ----------------------------- | ---------- | ------------------------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET`    | `/api/v3/workflows`                           | `both`, workspace `read`      | PoC        | Query: `workspaceId`, `limit?`, `cursor?`, `status?`               | List of workflow summaries plus pagination meta | Mirrors survey list pattern.                                                                     |
| `POST`   | `/api/v3/workflows`                           | `both`, workspace `readWrite` | PoC        | Body: `workspaceId`, `name`, `definition`, optional `status=draft` | Created workflow detail                         | API validates shared schema and server workspace scope.                                          |
| `GET`    | `/api/v3/workflows/[workflowId]`              | `both`, workspace `read`      | PoC        | Params: `workflowId`                                               | Workflow detail                                 | Resolve workflow first, then authorize against its `workspaceId`.                                |
| `PATCH`  | `/api/v3/workflows/[workflowId]`              | `both`, workspace `readWrite` | PoC        | Body: partial `name`, `definition`                                 | Updated workflow detail                         | Only draft/disabled edits are required for PoC.                                                  |
| `DELETE` | `/api/v3/workflows/[workflowId]`              | `both`, workspace `readWrite` | PoC        | Params: `workflowId`                                               | `{ id }`                                        | Hard delete is acceptable for PoC if runs cascade; soft delete is Beta if product wants archive. |
| `POST`   | `/api/v3/workflows/[workflowId]/enable`       | `both`, workspace `readWrite` | PoC        | Empty or `{}`                                                      | Workflow detail with `status=enabled`           | Validates definition before enabling.                                                            |
| `POST`   | `/api/v3/workflows/[workflowId]/disable`      | `both`, workspace `readWrite` | PoC        | Empty or `{}`                                                      | Workflow detail with `status=disabled`          | Disables future runs only.                                                                       |
| `GET`    | `/api/v3/workflows/[workflowId]/runs`         | `both`, workspace `read`      | PoC        | Query: `limit?`, `cursor?`, `status?`                              | List of run summaries plus pagination meta      | Order by newest `createdAt`.                                                                     |
| `GET`    | `/api/v3/workflows/[workflowId]/runs/[runId]` | `both`, workspace `read`      | PoC        | Params: `workflowId`, `runId`                                      | Run detail                                      | Must verify `run.workflowId` and `run.workspaceId`.                                              |

## Lifecycle Endpoint Notes

- `enable` allows `draft` -> `enabled` and `disabled` -> `enabled`.
- `disable` allows `enabled` -> `disabled`.
- Return-to-draft is deferred unless editing enabled workflows needs it. If needed, add
  `POST /api/v3/workflows/[workflowId]/draft` and mark it stretch, not baseline.

## Internal Trigger-Enqueue Contract

Do not add a public or externally reachable HTTP route for `response.completed` trigger enqueue in the PoC.
Accepting arbitrary response-completed payloads from clients would let callers fabricate runs.

Use a server-only service called from the existing response pipeline after the pipeline has validated the
workspace, survey, organization, and response payload:

```ts
enqueueResponseCompletedWorkflowRuns({
  workspaceId,
  surveyId,
  response,
});
```

The contract should still use shared zod input/output schemas and v3-style serializers so it can become an API
surface later without changing the workflow engine. It is not a dashboard-only shortcut: dashboard workflow
management remains backed by the v3 HTTP endpoints above, while trigger enqueue is an internal product event.

If a later Beta milestone needs an HTTP trigger-ingress endpoint, create a separate decision that defines its
internal authentication, caller boundary, replay protection, and abuse controls before adding the route.

## Deferred Beta Endpoints

| Method | Path                                                          | Reason Deferred                                                                 |
| ------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `POST` | `/api/v3/workflows/[workflowId]/dry-run`                      | Decision 003 excludes dry-run endpoint/UI from PoC.                             |
| `POST` | `/api/v3/workflows/[workflowId]/runs/[runId]/cancel`          | Cancel status remains schema-visible but UI/control is stretch.                 |
| `GET`  | `/api/v3/workflow-runs`                                       | Cross-workflow run list is useful later, but nested run list is enough for PoC. |
| `POST` | `/api/v3/workflows/triggers/response-completed`               | Deferred unless a server-only HTTP auth boundary is explicitly designed.        |
| `GET`  | `/api/v3/workflows/[workflowId]/versions`                     | Version snapshots are Beta.                                                     |
| `POST` | `/api/v3/workflows/[workflowId]/versions/[versionId]/restore` | Rollback is Beta.                                                               |
| N/A    | OpenAPI generated docs/spec updates                           | OpenAPI generation is explicitly deferred until Beta.                           |

## Error Shape

Use existing v3 helpers:

- `400 bad_request` for malformed JSON or schema validation.
- `401 not_authenticated` for missing session/API key.
- `403 forbidden` for missing workspace access or existence-sensitive resources.
- `429 too_many_requests` from wrapper rate limiting.
- `500 internal_server_error` for unexpected server/database errors.

## Implementation Order Recommendation

Start with schemas and service functions, then add route handlers, then call the internal trigger enqueue
service from the response pipeline. The dashboard should only be added after create/read/update/enable/disable
and run read endpoints exist.
