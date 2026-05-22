# Plan: Workflow Schema, Data Model, and Permissions

| Field     | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| Status    | Proposed                                                             |
| Owner     | Javier Aguilar                                                       |
| Milestone | [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md) |

## Goal

Design the workflow JSON schema, PostgreSQL persistence model, version-readiness strategy, and
workspace permission model for the MVP.

## Definition of Done

- Workflow definition schema covers nodes, edges, triggers, conditions, branches, actions, variables,
  metadata, and version metadata.
- Workflow definitions include an explicit `status` field (`draft`, `enabled`, `disabled`) with a
  small state machine that validates allowed transitions (`draft` -> `enabled`,
  `enabled` <-> `disabled`, `enabled`/`disabled` -> `draft`). Only `enabled` workflows are eligible to
  respond to trigger events at the orchestration layer.
- Workflow config data and run data are modeled as separate tables/documents.
- Workflow run data includes an explicit status field constrained to `queued`, `running`,
  `completed`, `failed`, or `canceled`.
- JSONB persistence rules and indexes are planned.
- Workspace ownership and permission checks are defined.
- Internal versioning strategy supports immutable enabled snapshots even if no versioning UI ships.
- Data privacy constraints are documented.

## Out of Scope

- Full data mapper/schema creator tool.
- Public version rollback UI.
- Cross-workspace workflows.
- Organization-wide workflows that bypass workspace permissions.

## Phases

| Phase | Scope                                                               | Acceptance Checks                                                          | Status   |
| ----- | ------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------- |
| A     | Draft workflow definition schema and action/trigger config schemas. | Schemas are strict enough for API validation and LLM/MCP generation.       | Proposed |
| B     | Design database tables for workflow config and workflow runs.       | Config/run lifecycle, JSONB fields, indexes, and relations are documented. | Proposed |
| C     | Define version snapshot behavior.                                   | Active runs execute against the version that was live when triggered.      | Proposed |
| D     | Define permissions and data access rules.                           | Workspace scoping, team role mapping, and denial cases are explicit.       | Proposed |
| E     | Final review pass.                                                  | Data model is ready for migration planning and API implementation.         | Proposed |

## Test and Validation Plan

- Unit tests for schema validation and invalid workflow definitions.
- Integration tests for run status persistence, workspace scoping, and permission denial.
- Unit tests for any TypeScript helpers that validate dry-run trigger payloads or workflow status
  transitions.
- Migration tests once Prisma schema changes are implemented.

## Manual QA Impact

Manual QA must verify that users cannot see, edit, run, or inspect workflows outside their workspace
access, and that workflow data shown in runs matches the creator's allowed workspace data scope.

## Changelog Impact

Category: Added

Note: Adds the persistent workflow definition and run-data model.

## Circuit Breakers

- Stop before creating migrations if workspace scoping or enabled version behavior is unresolved.
- Stop if JSON schema changes would make OpenAPI generation or LLM/MCP creation unreliable.
- Stop if storing action outputs creates unbounded data retention or privacy risk without a policy.

## Risk Notes

- JSONB gives flexibility but can hide breaking changes. Schema versioning and migration strategy need
  to be explicit from the first implementation.

## Architecture Reference

- [research/docs/diagrams.md](../../research/docs/diagrams.md) — diagram 6 is the indicative data model this
  plan refines. Diagrams 3 (workflow lifecycle) and 5 (run status) are the state machines the schema
  must encode.

## Decision-Record Check

- Uses [002 Workflows technical architecture](../../blueprint/decisions/002-workflows-tech.md).
- Create a new decision if persistence shifts from JSONB documents to fully normalized step tables.

## Final Review

- Checks run and recorded.
- Workbench docs updated.
- Follow-ups captured.

- [x] Reviewed and refined by: Javier Aguilar
