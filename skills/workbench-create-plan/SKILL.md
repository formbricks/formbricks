---
name: workbench-create-plan
description:
  Use when the user asks to create, draft, add, or plan a new implementation plan in an established planning workflow,
  including finding the workbench root, reading GUIDE.md, choosing the next milestone-scoped plan number, updating the
  target blueprint milestone record, creating a cowork plan file, and asking whether implementation should start
  afterward.
---

# Workbench Plan Creator

Create or update an implementation plan inside an already established planning workflow.

Do not use this skill to bootstrap, upgrade, or repair the workflow itself. If the project has no standalone
`<workbench-root>/GUIDE.md`, or the user asks to modernize the workflow, use `setup-specs-workflow` instead.

## Workbench Layout

Treat the planning root as the workbench root. In this repository that is `workbench/`.

- Workflow guide: `<workbench-root>/GUIDE.md`
- Product truth: `<workbench-root>/blueprint/`
- Milestone index: `<workbench-root>/blueprint/MILESTONES.md`
- Milestone records: `<workbench-root>/blueprint/milestones/`
- Business rules: `<workbench-root>/blueprint/business-rules/`
- Decisions: `<workbench-root>/blueprint/decisions/`
- Design/checks/manual QA/security/env docs: `<workbench-root>/blueprint/`
- Plans/checkpoints/bug fixes/prompts/templates: `<workbench-root>/cowork/`
- Plan records: `<workbench-root>/cowork/plans/`
- Checkpoint records: `<workbench-root>/cowork/checkpoints/`
- Bug-fix index: `<workbench-root>/cowork/BUG_FIXES.md`
- Coordination board: `<workbench-root>/cowork/COORDINATOR.md`
- Research notes and reference assets: `<workbench-root>/research/`

Blueprint docs are human-owned product truth. AI may formalize, structure, and improve a human prompt or draft, but
product concepts, milestone direction, and durable rules must come from humans and receive human review.

Milestones and plans must end with a completed human review gate before downstream work proceeds. The required line is
`- [ ] Reviewed and refined by: TBD`; after human review it should become something like
`- [ ] Reviewed and refined by: Javier`.

## Workflow

1. Resolve the target planning root:
   - Use the root named by the user when provided.
   - Otherwise prefer a directory with `GUIDE.md` and `blueprint/MILESTONES.md`.
   - Check common roots in this order: `workbench/`, `.specs/`, `docs/`, `project-specs/`, `.agents/specs/`, `ai/`.
   - If multiple plausible roots exist, choose the one whose `GUIDE.md` describes the active workflow or ask when the
     answer is not clear.
2. Read project context in tiers:
   - Always read only the root agent guide if present, `<workbench-root>/GUIDE.md`,
     `<workbench-root>/blueprint/PRODUCT.md`, `<workbench-root>/blueprint/MILESTONES.md`,
     `<workbench-root>/cowork/BUG_FIXES.md`, relevant `<workbench-root>/blueprint/business-rules/` files,
     `<workbench-root>/cowork/COORDINATOR.md`, `<workbench-root>/blueprint/CHECKS.md`, and
     `<workbench-root>/blueprint/MANUAL_QA.md`.
   - Read the active or requested milestone record before opening related plans or checkpoints.
   - Read `DESIGN.md`, decisions, business-rule records, bug-fix records, research notes, setup docs, security docs, env
     docs, and implementation files only when they affect the requested plan.
   - Use `rg`, filename scans, and index rows to find relevant records before opening full files.
   - Do not bulk-read all plans, checkpoints, decisions, or business-rule records.
3. Minimum context sources:
   - root `AGENTS.md`, `CLAUDE.md`, or `.cursor/rules` if present
   - `<workbench-root>/GUIDE.md`
   - `<workbench-root>/blueprint/PRODUCT.md`
   - `<workbench-root>/blueprint/MILESTONES.md`
   - `<workbench-root>/cowork/BUG_FIXES.md`
   - relevant `<workbench-root>/blueprint/business-rules/` files
   - `<workbench-root>/cowork/COORDINATOR.md`
   - `<workbench-root>/blueprint/CHECKS.md`
   - `<workbench-root>/blueprint/MANUAL_QA.md`
4. Treat `<workbench-root>/GUIDE.md` as the workflow source of truth for status vocabulary, numbering, file naming,
   template usage, spec revision rules, checkpoint expectations, and index ownership.
5. Check whether the request belongs in a bug-fix record instead of a plan:
   - Use `<workbench-root>/cowork/templates/BUG_FIX.md` and update `<workbench-root>/cowork/BUG_FIXES.md` when the work
     is primarily a scoped defect report and fix proposal that does not need milestone sequencing, multiple
     implementation phases, or roadmap visibility.
   - Continue with plan creation when the fix expands into broad feature work, durable architecture changes, migrations,
     cross-domain behavior, or multi-phase delivery.
6. Determine the target milestone:
   - Use the milestone named by the user when provided.
   - Otherwise use the active milestone from `<workbench-root>/blueprint/MILESTONES.md`.
   - If there is no active milestone, pick the clearly requested milestone or ask whether to create/select one.
   - If the target milestone is missing a completed human review gate or still says `TBD`, stop before creating the plan
     and ask the user to review and refine the milestone first.
7. Choose `PPP` for a new plan:
   - Use the user's requested plan number only when it is exactly three digits and unused inside the target milestone.
   - Otherwise pick the next unused three-digit plan number after scanning `<workbench-root>/cowork/plans/` and the
     target milestone record's **Drafted Plans** section.
   - Never reuse cancelled, retired, or superseded plan numbers.
8. Create or update `<workbench-root>/cowork/plans/MMM-PPP-kebab-case-title.md`:
   - Prefer `<workbench-root>/cowork/templates/PLAN.md` when present.
   - If the template is missing, follow the plan requirements in `<workbench-root>/GUIDE.md`.
   - Draft phases A, B, C... with the final phase named **Final review pass**.
   - Include definition of done, out of scope, phase acceptance checks, validation plan, manual QA impact, circuit
     breakers, risk notes, changelog impact, documentation updates, and decision-record check.
   - End the record with `- [ ] Reviewed and refined by: TBD` unless a human has already reviewed and refined it.
9. Update the target milestone record:
   - Add or update the plan row in the milestone record's **Drafted Plans** section.
   - Keep plan registries and phase maps in the milestone record, not in `MILESTONES.md`.
10. Update `<workbench-root>/blueprint/MILESTONES.md` only when cross-milestone focus changed: active milestone,
    recommended next plan, latest checkpoint, milestone status, or recommended execution order.
11. Apply the spec revision rule: material changes to accepted or active plans require an explicit plan update before
    implementation continues, and unplanned work that changes behavior, architecture, configuration, APIs, operational
    flows, security posture, manual QA coverage, verification commands, or user-facing workflows must update the closest
    relevant spec in the same turn.

12. If `<workbench-root>/scripts/validate-workbench.mjs` exists, run
    `node <workbench-root>/scripts/validate-workbench.mjs <workbench-root>` and treat failures as blockers.
13. Preserve git index state. Do not stage, unstage, commit, amend, reset, or discard files unless explicitly asked.

## Plan Content Requirements

Include:

- status table with all phases initially `Proposed`
- goal
- definition of done with testable outcomes
- out of scope
- phases with goal, likely files or areas, deliverables, and acceptance checks
- test / validation plan that references `<workbench-root>/blueprint/CHECKS.md`
- manual QA impact that references `<workbench-root>/blueprint/MANUAL_QA.md`
- changelog impact using `Added`, `Changed`, `Fixed`, `Removed`, `Security`, `Operations`, `QA / Verification`, or
  `None`, plus a short human-readable note when release-visible
- circuit breakers and stop conditions
- risk notes
- decision-record check with links to created, existing, or superseded decisions
- documentation update checklist
- final **Final review pass** phase

## Circuit Breakers

Every plan should tell implementation agents when to stop instead of looping:

- Stop after two repeated failures of the same check with no new evidence or changed approach.
- Stop when requirements, business rules, decisions, or implementation constraints conflict.
- Stop when required verification cannot run and no documented fallback exists.
- Stop when the work expands beyond the active plan's scope.
- Stop before changing public behavior, security posture, data model, deployment flow, or manual QA coverage unless the
  relevant spec update is included.

## Implementation Offer

After creating or updating the plan and reporting the files changed, ask the user to read and review the plan, target
milestone, and any related blueprint docs in detail. Do not ask whether implementation should start until the plan has a
completed human review gate.

If the plan already has a completed human review gate, prefer a native choice UI when the host makes one available:

- In Codex, if a `request_user_input` style tool is available, use it before ending the turn. Ask: "Implement this plan
  now?" with choices:
  - `Implement this plan` - start implementing from the new plan in this thread.
  - `Just save the plan` - stop after the plan handoff.
- In Cursor or another host with an equivalent native quick-pick/choice UI, use the closest equivalent.

If the plan already has a completed human review gate and no native choice UI is available, end the final response with a
concise plain-text question:

```text
Want me to start implementing this plan now?
- Implement this plan
- Just save the plan
```

Do not begin implementation until the review gate is completed and the user chooses or clearly says yes. If the user
chooses implementation, continue from the plan using the project's normal plan/checkpoint workflow. If a separate
fresh-agent handoff is more appropriate, offer or generate an implementation prompt instead of editing code immediately.

## Final Response

Report:

- plan or bug-fix record created or updated
- milestone record or `BUG_FIXES.md` row added or changed
- plan or bug-fix number and status used
- related checks/manual QA/spec docs updated or left as `TBD`
- validator/checks run, if any

Then ask the user to read and review the plan and related docs in detail before treating them as accepted direction.
Tell them to replace the review gate with their name after review and refinement. Do not offer to implement an unreviewed
plan.

Keep the response concise. Do not paste the full plan or bug-fix record unless the user asks.
