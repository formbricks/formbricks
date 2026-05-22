# Plan: Follow-ups, Webhooks, Migration, and QA

| Field     | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| Status    | Proposed                                                             |
| Owner     | Javier Aguilar                                                       |
| Milestone | [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md) |

## Goal

Reframe existing Follow-ups and Webhooks as workflow concepts for the MVP while preserving current
behavior and making the migration path clear.

## Definition of Done

- Existing Follow-ups behavior is mapped to workflow trigger, condition, and Send Email action.
- Existing Webhooks behavior is mapped to Send Webhook / API Call action where practical.
- Backward compatibility and migration behavior are documented.
- Current follow-up email behavior does not regress.
- Existing webhook behavior does not regress.
- Manual QA covers old and new paths during the transition.

## Out of Scope

- Migrating every integration to workflows.
- Removing old Follow-ups UI until a product migration decision is accepted.
- Supporting encrypted webhook headers/secrets in the MVP.
- Supporting webhook-received triggers.

## Phases

| Phase | Scope                                               | Acceptance Checks                                                                                             | Status   |
| ----- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------- |
| A     | Inventory current Follow-ups and Webhooks behavior. | Current triggers, conditions, recipients, templates, and side effects are documented.                         | Proposed |
| B     | Map current behavior to workflow schemas/actions.   | Workflow representation can express response completion, thank-you-card condition, and email/webhook actions. | Proposed |
| C     | Plan migration/backward compatibility.              | Existing customers keep current behavior unless explicitly migrated.                                          | Proposed |
| D     | Add QA coverage for old and new paths.              | Manual and automated checks cover Follow-ups and Webhooks before and after workflow changes.                  | Proposed |
| E     | Final review pass.                                  | Migration plan is clear enough for implementation and release notes.                                          | Proposed |

## Test and Validation Plan

- Regression tests around existing follow-up email behavior.
- Regression tests around existing webhook delivery behavior.
- Workflow tests for equivalent Send Email and Send Webhook / API Call actions.
- Playwright E2E coverage for the crucial migration path when the UI surface is available; do not add
  TSX/component unit tests for the UI.
- Manual QA from [MANUAL_QA.md](../../blueprint/MANUAL_QA.md), especially integration/email flows.

## Manual QA Impact

Manual QA must cover current Follow-ups, workflow-backed Send Email, current Webhooks, workflow-backed
Webhook/API action, and failure/latency visibility.

## Changelog Impact

Category: Changed

Note: Reframes Follow-ups and Webhooks as workflow-backed automation concepts while preserving
existing behavior.

## Circuit Breakers

- Stop if existing Follow-ups behavior would break or silently change.
- Stop if existing Webhooks behavior would lose delivery guarantees or observability.
- Stop if a migration would require irreversible data changes without a rollback plan.

## Reuse Opportunities

- Formbricks already ships REST integration clients for Slack, Notion, HubSpot, Airtable, and Google
  Sheets under `apps/web/modules/integrations/`, plus the webhook delivery path under
  `packages/jobs`. The MVP only bridges Webhooks and Follow-ups, but the workflow action interface
  should be designed so wrapping any of those existing clients as a future workflow action is a
  small, additive task instead of a rewrite. The "imagine sending something to Linear when a
  response is completed" scenario should become trivial once a Linear-style integration exists.
- Audit the existing webhook delivery code first (timeouts, retries, error capture, signing) and
  prefer reusing or extracting it for Send Webhook / API Call instead of building a parallel HTTP
  client inside the workflow engine.
- Do not add Slack/Notion/HubSpot/Airtable/Sheets workflow actions in this milestone, even if the
  underlying client makes it easy. Surfacing them belongs in a later iteration with its own decision.

## Risk Notes

- Users may rely on subtle existing Follow-ups behavior. Migration must be explicit and tested before
  replacing the current UX.

## Architecture Reference

- [research/docs/diagrams.md](../../research/docs/diagrams.md) — diagram 7 (existing asset reuse) shows the
  two solid MVP reuses (Follow-ups → Send Email, `packages/jobs` webhook delivery → Send Webhook)
  and the five dashed post-MVP candidates. This plan implements the solid arrows.

## Decision-Record Check

- Uses [002 Workflows technical architecture](../../blueprint/decisions/002-workflows-tech.md).
- Create a decision if the product removes or materially renames Follow-ups as a standalone feature.

## Final Review

- Checks run and recorded.
- Workbench docs updated.
- Follow-ups captured.

- [x] Reviewed and refined by: Javier Aguilar
