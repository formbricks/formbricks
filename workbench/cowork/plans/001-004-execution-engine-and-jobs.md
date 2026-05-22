# Plan: Execution Engine and Jobs

| Field     | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| Status    | Proposed                                                             |
| Owner     | Javier Aguilar                                                       |
| Milestone | [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md) |

## Goal

Build the queue-backed workflow execution engine using BullMQ and `packages/jobs`, including
idempotency, retries, side-effect isolation, concurrency controls, and initial scale strategy.

## Definition of Done

- Workflow run jobs can be enqueued from supported triggers.
- Workflow run status transitions are implemented with the MVP vocabulary: `queued`, `running`,
  `completed`, `failed`, and `canceled`.
- Worker executes workflow steps in graph order with condition/branch support.
- Step inputs and outputs are persisted into the run document.
- Send Email and Webhook/API side effects are idempotent under retries.
- Retry policy, timeout policy, and failure behavior are defined.
- Worker concurrency and scaling defaults are documented.
- High-volume response-trigger risks have an MVP mitigation plan.

## Out of Scope

- General scheduling workflows.
- Delayed/postponed workflow continuation.
- Human input steps.
- Distributed workflow orchestration beyond BullMQ.

## Phases

| Phase | Scope                                                                    | Acceptance Checks                                                                   | Status   |
| ----- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | -------- |
| A     | Define job payloads, queues, and worker ownership under `packages/jobs`. | Queue names, payload schemas, and run statuses are documented.                      | Proposed |
| B     | Implement run orchestration and step execution model.                    | Engine can evaluate trigger input, conditions, branches, actions, and run statuses. | Proposed |
| C     | Add idempotency and retry policy for side effects.                       | Duplicate delivery tests do not duplicate email/webhook side effects.               | Proposed |
| D     | Add concurrency, timeout, failure isolation, and backpressure defaults.  | Webhook latency/failure cannot bring down workers or block unrelated runs globally. | Proposed |
| E     | Final review pass.                                                       | Execution engine behavior is documented, tested, and ready for MVP actions.         | Proposed |

## Test and Validation Plan

- Unit tests for graph execution, branch selection, step outputs, and terminal run statuses.
- Integration tests for BullMQ enqueue/dequeue behavior.
- Status transition tests for `queued` -> `running`, retry/backoff back to `queued`, and terminal
  `completed`, `failed`, or `canceled`.
- Unit/integration tests for dry-run execution using simulated trigger data, including no-send
  behavior for Send Email and Send Webhook / API Call.
- Failure tests for retry, timeout, idempotency, and external webhook errors.
- Scale-oriented smoke tests for many trigger events when practical.

## Manual QA Impact

Manual QA should verify that workflow runs progress asynchronously, failed webhook/email steps are
visible in run detail, and retries do not create duplicate side effects.

## Changelog Impact

Category: Operations

Note: Adds a queue-backed workflow execution layer and operational behavior for workflow workers.

## Circuit Breakers

- Stop if idempotency cannot be proven for MVP side-effect actions.
- Stop if webhook failures can crash or starve the worker.
- Stop if worker configuration would be unsafe for Formbricks Cloud volume.

## Risk Notes

- Response volume can multiply quickly across thousands of workspaces. Batching or buffering may be
  needed sooner than feature scope suggests.

## Architecture Reference

- [research/docs/diagrams.md](../../research/docs/diagrams.md) — diagram 4 (run execution flow) and diagram 5
  (run status state machine) describe the worker behavior this plan implements. Diagram 1 (system
  component map) shows where the worker sits in the runtime topology.

## Decision-Record Check

- Uses [002 Workflows technical architecture](../../blueprint/decisions/002-workflows-tech.md).
- Create a new decision for production worker topology, batching, or concurrency defaults if they
  become durable platform policy.

## Final Review

- Checks run and recorded.
- Workbench docs updated.
- Follow-ups captured.

- [x] Reviewed and refined by: Javier Aguilar
