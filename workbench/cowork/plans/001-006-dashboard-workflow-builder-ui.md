# Plan: Dashboard Workflow Builder UI

| Field     | Value                                                                |
| --------- | -------------------------------------------------------------------- |
| Status    | Proposed                                                             |
| Owner     | Javier Aguilar                                                       |
| Milestone | [001 Workflows MVP](../../blueprint/milestones/001-workflows-mvp.md) |

## Goal

Build the dashboard workflow management experience as a client of the v3 API, including the React
Flow builder, configured workflows list, workflow runs list, and run detail surface.

## Definition of Done

- UI consumes v3 API endpoints only for workflow behavior.
- UI imports the shared client-safe workflow zod schemas and validates drafts locally before save,
  activation, and dry-run requests. Local validation renders immediate node/drawer errors and prevents
  obviously invalid submits, but the UI still handles authoritative API validation errors.
- Workflow list supports viewing configured workflows and their lifecycle status (`draft`, `enabled`,
  `disabled`), with explicit controls to save as draft, enable, disable, re-enable, and return to
  draft. Controls call the v3 API state-transition endpoints, not UI-only mutations.
- Workflow builder uses xyflow / React Flow and existing dashboard UI patterns.
- Workflow builder state follows
  [Decision 004 — Workflows builder state management](../../blueprint/decisions/004-workflows-builder-state-management.md):
  the PoC uses scoped Jotai + Immer for editor-local state such as selected node, open drawer, dirty
  draft, local validation issues, and canvas UI state. API/server data remains owned by the v3 API or
  an explicit server-state layer, and the workflow JSON document remains the source of truth.
- Workflow builder follows the staged workflow research screenshots for look and feel where they fit
  the current dashboard design system.
- Node configuration uses existing Formbricks form components where practical.
- The side control panel is implemented as a fixed or absolute drawer over the canvas and can be
  collapsed.
- Builder exposes a dry-run button that opens a form for simulating the selected trigger data and
  displays validation, branch, compute, and no-send side-effect results from the v3 API.
- Workflow runs list supports pagination, status (`queued`, `running`, `completed`, `failed`, or
  `canceled`), dates, and duration.
- Run detail exposes metadata, logs, action outputs, timestamps, and failure reasons.
- MVP limitations are visible where relevant, including that webhook/API headers can be configured
  but are not encrypted secret storage and that Send Webhook / API Call posts a fixed envelope with
  no user-authored body templating.
- Sidebar placement is decided and implemented consistently.

## Out of Scope

- Version rollback UI.
- Full visual data mapper/schema creator.
- Mobile dashboard support beyond existing `NoMobileOverlay` behavior.
- Non-MVP actions such as loops, delays, and human input steps.

## Phases

| Phase | Scope                                                                   | Acceptance Checks                                                                                           | Status   |
| ----- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| A     | Decide IA and route placement.                                          | Placement is documented: under Unify Feedback / Dashboards or a dedicated Workflows group.                  | Proposed |
| B     | Build workflow list and create/edit shell.                              | UI lists workflows and loads definitions through v3 API.                                                    | Proposed |
| C     | Build React Flow canvas, collapsible drawer, and action/trigger picker. | Builder edits schema-valid workflow JSON, runs shared zod validation locally, and uses reusable components. | Proposed |
| D     | Build runs table and run detail views.                                  | Paginated runs and detailed logs/actions/metadata are visible.                                              | Proposed |
| E     | Final review pass.                                                      | UI is accessible, localized, API-backed, and manually QA-ready.                                             | Proposed |

## Research Inputs

- [Workflows Builder design guidelines](../../blueprint/guidelines/design-guidelines-workflows.md) — the design
  blueprint for this plan. Defines page architecture, canvas, node anatomy, category color system,
  drawer behavior, list/run pages, status pills, sizing, tokens, and the reuse map against the
  dashboard component catalog. All UI work in this plan must conform to it; deviations require an
  update to the guide first.
- [Dashboard component catalog](../../blueprint/guidelines/components-guide-dashboard.md) — the source of truth
  for which existing components to reuse before introducing net-new components.
- [Workflow canvas reference](../../research/images/workflows-design-1.png)
- [Workflow controls reference](../../research/images/workflows-design-2-controls.png)
- [Workflow sidebar reference](../../research/images/workflows-sidebar.png)
- [Twenty action choice reference](../../research/images/twenty-design-action-choice.png)
- [Follow-ups email reference](../../research/images/followups-emails.png)
- [Initial prototype logic](../../research/workflows-proto-logic/) — concept reference for workflow
  schemas, refs, validation, descriptors, AI generation, and Jotai editor state. Use as inspiration,
  not as a copy source; align it with the accepted workflow lifecycle, run statuses, graph model, and
  v3 API-first contract before reusing any code.

## Test and Validation Plan

- Unit tests for non-TSX TypeScript helpers where applicable.
- Unit tests for any UI-side non-TSX adapters that convert React Flow/drawer state into workflow JSON
  before passing it to the shared schemas.
- Do not add TSX/component unit tests for workflow UI.
- Playwright E2E coverage for crucial workflow UI paths, including create/edit, enable/disable,
  local validation errors before submit, authoritative API validation errors after submit, dry-run
  with simulated trigger data, run list/detail inspection, and permission denial.
- API integration tests remain the source of truth for behavior.
- Run i18n validation after adding user-facing strings.

## Manual QA Impact

Manual QA must cover create/edit/enable/disable, canvas editing, action config, dry-run trigger
data simulation, run list pagination, run status display/filtering, run detail logs, failure states,
permission denial, and MVP limitation disclosures.

## Changelog Impact

Category: Added

Note: Adds the dashboard workflow builder and run inspection surfaces.

## Circuit Breakers

- Stop if the UI needs behavior that has no v3 API endpoint.
- Stop if React Flow state and workflow JSON drift into separate sources of truth.
- Stop if Jotai atoms become the authoritative source for server/API state instead of editor-local
  state derived from API data and workflow JSON.
- Stop if React Hook Form or TanStack Query are introduced as mandatory builder architecture instead
  of being justified by concrete Beta complexity and benefits.
- Stop if frontend validation requires a forked schema instead of the shared workflow schemas.
- Stop if IA placement conflicts with existing dashboard navigation rules.

## Risk Notes

- The survey editor accumulated coupling around UI-specific state. Workflows should keep the JSON
  definition as the source of truth and derive UI state from it where practical.
- Jotai is not currently an app-wide dashboard convention in this repo; introducing it is accepted
  for the workflow builder by Decision 004 if it stays isolated to the builder subtree, is covered by
  tests for non-TSX state adapters when complexity grows, and does not replace the API/query layer for
  persisted data.

## Decision-Record Check

- Uses [001 Workflows API-first backend contract](../../blueprint/decisions/001-workflows-api-first-backend-contract.md).
- Uses [002 Workflows technical architecture](../../blueprint/decisions/002-workflows-tech.md).
- Uses [004 Workflows builder state management](../../blueprint/decisions/004-workflows-builder-state-management.md).
- Create a decision if final IA changes product navigation conventions.
- Create a decision if Jotai becomes a broader dashboard state-management standard rather than the
  accepted workflow-builder implementation detail.

## Final Review

- Checks run and recorded.
- Workbench docs updated.
- Follow-ups captured.

- [x] Reviewed and refined by: Javier Aguilar
