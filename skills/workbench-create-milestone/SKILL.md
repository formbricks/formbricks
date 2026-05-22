---
name: workbench-create-milestone
description:
  Use when the user asks to create, draft, add, or update a milestone in an existing project planning workflow,
  including finding the workbench root, reading GUIDE.md, choosing the next three-digit milestone number, creating or
  updating blueprint/milestones/NNN-slug.md, and updating blueprint/MILESTONES.md without duplicating milestone detail
  into the index.
---

# Workbench Milestone Creator

Create or update a milestone inside an already established planning workflow.

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
- Plans/checkpoints/bug fixes/prompts/templates: `<workbench-root>/cowork/`
- Coordination board: `<workbench-root>/cowork/COORDINATOR.md`
- Research notes and reference assets: `<workbench-root>/research/`

Blueprint docs are human-owned product truth. AI may formalize, structure, and improve a human prompt or draft, but the
concepts must come from humans and the final milestone needs human review.

Milestones must end with a review gate line: `- [ ] Reviewed and refined by: TBD`. Do not create plans or start
implementation under a milestone until that line has been completed by a human, e.g.
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
     relevant `<workbench-root>/blueprint/business-rules/` files, and `<workbench-root>/cowork/COORDINATOR.md`.
   - Read `<workbench-root>/blueprint/milestones/` filenames or index rows before opening milestone records.
   - Open only milestone records, decisions, plans, checkpoints, business rules, research notes, setup docs, design
     docs, or implementation files that are directly relevant to the requested milestone.
   - Do not bulk-read the planning root or every record in a directory.
3. Minimum context sources:
   - root `AGENTS.md`, `CLAUDE.md`, or `.cursor/rules` if present
   - `<workbench-root>/GUIDE.md`
   - `<workbench-root>/blueprint/PRODUCT.md`
   - `<workbench-root>/blueprint/MILESTONES.md`
   - relevant `<workbench-root>/blueprint/business-rules/` files
   - `<workbench-root>/cowork/COORDINATOR.md`
4. Treat `<workbench-root>/GUIDE.md` as the workflow source of truth for status vocabulary, numbering, file naming,
   template usage, and index ownership.
5. Determine whether to create a new milestone or update an existing one:
   - If the user names an existing milestone number, title, or record, update that record and its index row.
   - Otherwise create a new milestone record.
6. For a new milestone, choose `NNN`:
   - Use the user's requested number only when it is exactly three digits and unused.
   - Otherwise pick the next unused three-digit number after scanning `<workbench-root>/blueprint/MILESTONES.md` and
     `<workbench-root>/blueprint/milestones/*.md`.
   - Never reuse retired, cancelled, or superseded milestone numbers.
7. Create or update `<workbench-root>/blueprint/milestones/NNN-kebab-case-title.md`:
   - Prefer `<workbench-root>/cowork/templates/MILESTONE.md` when present.
   - If the template is missing, follow the milestone requirements in `<workbench-root>/GUIDE.md`.
   - Use `Proposed` by default unless the user explicitly says the milestone should be active, blocked, done, or
     dropped.
   - Keep objective, scope, non-goals, related work, acceptance criteria, risks, drafted plans, phase map, and
     checkpoint rollup in the milestone record.
   - End the record with `- [ ] Reviewed and refined by: TBD` unless a human has already reviewed and refined it.
8. Update `<workbench-root>/blueprint/MILESTONES.md`:
   - Add or update the milestone index row with number, title, status, record link, and summary.
   - Keep it as an index only. Do not paste drafted-plan registries, phase maps, risks, acceptance criteria, or
     checkpoint rollups into `MILESTONES.md`.
   - Update current focus, recommended next plan, latest checkpoint, or execution order only when the user asked for
     that or the new milestone clearly changes cross-milestone state.
9. Normalize links and vocabulary:
   - Use exactly three-digit milestone IDs.
   - Use the exact status vocabulary from `GUIDE.md`.
   - Link related PRD sections, business rules, decisions, plans, checkpoints, or research notes when known.
   - Mark unknown product facts as `TBD` rather than inventing details.
10. If `<workbench-root>/scripts/validate-workbench.mjs` exists, run
    `node <workbench-root>/scripts/validate-workbench.mjs <workbench-root>` and treat failures as blockers.
11. Preserve git index state. Do not stage, unstage, commit, amend, reset, or discard files unless explicitly asked.

## Active Milestone Caution

If the user asks to make the new milestone `Active` and another milestone is already active, do not silently rewrite
roadmap focus. Ask whether to switch focus, or keep the new milestone `Proposed` and mention the conflict.

If the user only asks to "create a milestone", default to `Proposed`.

## Final Response

Report:

- milestone record created or updated
- `MILESTONES.md` row added or changed
- status and milestone number used
- related docs linked or left as `TBD`
- validator/checks run, if any

Then ask the user to read and review the milestone and any related blueprint docs in detail before treating them as
accepted product truth. Tell them to replace the review gate with their name after review and refinement.

Keep the response concise. Do not paste the full milestone unless the user asks.
