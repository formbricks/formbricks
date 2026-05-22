# Plan: Run Observability, Audit, and Dry Runs

| Field     | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| Status    | Proposed                                                             |
| Owner     | Javier Aguilar                                                       |
| Milestone | [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md) |

## Goal

Make workflow execution inspectable and trustworthy through run logs, audit events, elapsed-time
tracking, failure metadata, and safe dry/test runs.

## Definition of Done

- Workflow runs record status, start/end timestamps, elapsed time, trigger input reference, step
  outputs, and errors.
- Run status is constrained to `queued`, `running`, `completed`, `failed`, and `canceled`.
- Step logs include enough context to explain why a run failed or branched.
- Webhook/API actions track failure reason, latency, elapsed time, and retry state.
- Simple audit logs capture workflow create/update/enable/disable and relevant run operations.
- Dry run / test run behavior is defined with sample, selected, or manually entered trigger data.
- Dashboard dry runs are triggered from a dry-run button and show validation, branch, compute, logs,
  and no-send side-effect results.
- Run detail API and UI can show logs without exposing data outside workspace permissions.

## Out of Scope

- Full compliance-grade audit trail if it exceeds MVP scope.
- Long-term analytics dashboards over workflow performance.
- Manual rerun workflows unless explicitly accepted during implementation.

## Phases

| Phase | Scope                                                    | Acceptance Checks                                                              | Status   |
| ----- | -------------------------------------------------------- | ------------------------------------------------------------------------------ | -------- |
| A     | Define run log and audit event schemas.                  | Schemas capture run status, timing, errors, action outputs, and actor/context. | Proposed |
| B     | Persist execution logs and action timing.                | Runs expose useful debugging detail after success and failure.                 | Proposed |
| C     | Add webhook/email failure tracking and retry visibility. | External side-effect failures are visible without crashing workers.            | Proposed |
| D     | Define dry/test run semantics.                           | Safe simulated-trigger execution is documented and tested.                     | Proposed |
| E     | Final review pass.                                       | Logs/audit/dry run behavior is visible through API and dashboard.              | Proposed |

## Test and Validation Plan

- Unit tests for log event creation and status transitions.
- Unit tests for dry-run log/result construction.
- Integration tests for run status persistence and filtering.
- Integration tests for failed action logs, retry metadata, and run detail retrieval.
- Integration tests for dry-run execution with simulated trigger data and suppressed side effects.
- API tests for permission denial on run/log access.

## Manual QA Impact

Manual QA must dry-run workflows with simulated trigger data, intentionally create successful and
failed runs, inspect logs, verify elapsed time and failure reasons, and confirm denied users cannot
inspect another workspace's run details.

## Changelog Impact

Category: Added

Note: Adds observable workflow run logs, simple auditability, and dry/test run support.

## Circuit Breakers

- Stop if logs expose sensitive data beyond workspace permissions.
- Stop if external action failures are not inspectable.
- Stop if dry run semantics could accidentally perform real side effects without clear controls.
- Stop if the dry-run form cannot generate trigger payloads that match the same schemas used by real
  trigger events.

## Risk Notes

- Run documents can grow large if every log and output is embedded forever. MVP storage and retention
  expectations should be explicit before production rollout.

## Design Reference

- [Workflows Builder design guidelines](../../blueprint/guidelines/design-guidelines-workflows.md) — source of
  truth for the Run Detail page (read-only canvas with status-decorated nodes, right-side inspector
  with Input/Output/Logs tabs), run status pills, dry-run launcher, and the dry-run banner. Any
  observability surface with UI must follow it.

## Decision-Record Check

- Uses [002 Workflows technical architecture](../../blueprint/decisions/002-workflows-tech.md).
- Create a decision if audit logging moves from simple product trace to formal compliance posture.

## Final Review

- Checks run and recorded.
- Workbench docs updated.
- Follow-ups captured.

- [x] Reviewed and refined by: Javier Aguilar
