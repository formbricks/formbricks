# Cowork Guide

This guide defines the project workflow for AI and human development sessions.

## Planning Root

The workbench root is `workbench/`.

- Durable product truth lives in `workbench/blueprint/`.
- Active execution records live in `workbench/cowork/`.
- Research notes, prototype references, and screenshots live in `workbench/research/`.
- Ignored local-only data lives in `workbench/local/`.
- Ignored scratch notes live in `workbench/scratch/`.

## Token-Efficient Context

Before substantial implementation work, gather context in this order:

1. Read `AGENTS.md`, this guide, and `workbench/README.md`.
2. Use indexes first: `workbench/blueprint/EPICS.md`, `workbench/blueprint/MILESTONES.md`, and `workbench/cowork/COORDINATOR.md`.
3. Open only the relevant milestone, plan, bug-fix, decision, business-rule, check, manual QA, setup, env, security, or guideline sections.
4. Use `rg` for terms, paths, statuses, and links before opening large files.
5. Avoid reading full directories or long historical records unless the current task depends on them.

Keep outputs compact: report changed records, blockers, validation results, and next action. Do not paste full workbench documents or verbose checkpoint narratives unless explicitly requested.

## Status Vocabulary

Use these statuses unless a local file defines a narrower vocabulary:

- `Proposed`
- `Ready`
- `Active`
- `Blocked`
- `Done`
- `Dropped`

Decision records may also use `Accepted` or `Superseded by NNN` because they track durable choices rather than
execution state.

## Work Types

- Product truth belongs in `workbench/blueprint/PRODUCT.md`.
- Current domain behavior belongs in `workbench/blueprint/business-rules/`.
- Durable rationale belongs in `workbench/blueprint/decisions/`.
- Roadmap sequencing belongs in `workbench/blueprint/MILESTONES.md` and `workbench/blueprint/milestones/`.
- Implementation plans belong in `workbench/cowork/plans/`.
- Phase completion notes belong in `workbench/cowork/checkpoints/`.
- Scoped defects belong in `workbench/cowork/bug-fixes/`.
- Active parallel work belongs in `workbench/cowork/COORDINATOR.md`.
- Automated verification belongs in `workbench/blueprint/CHECKS.md`.
- Manual verification belongs in `workbench/blueprint/MANUAL_QA.md`.

## Blueprint Human Ownership

Documents in `workbench/blueprint/` are human-owned product truth. AI agents may help refine wording, improve structure, connect references, and turn a human-written prompt or partial draft into a more formal document, but the concepts must originate from humans and the final document must be reviewed by humans.

Agents must not invent product direction, business rules, milestones, architecture decisions, security posture, env expectations, checks, manual QA, or design guidance for `workbench/blueprint/`. If a blueprint update lacks human-provided source material or review, mark the uncertain parts as `TBD` and ask for human input.

## Review Gates

Milestones, plans, bug fixes, decisions, business rules, and checkpoints end with:

```markdown
- [ ] Reviewed and refined by: TBD
```

Before starting implementation, the relevant plan must have a completed human review line, for example `- [ ] Reviewed and refined by: Javier`. Before creating plans or implementing work under a milestone, the milestone must have the same completed review line. Before implementing a bug fix, the bug-fix record must be reviewed. If the line is missing or still `TBD`, stop and ask for human review instead of proceeding.

## Workbench Validation

Run the validator after editing workbench records, workflow templates, workflow skills, or `AGENTS.md` workbench instructions:

```bash
node workbench/scripts/validate-workbench.mjs workbench
```

From inside `workbench/`, run:

```bash
node scripts/validate-workbench.mjs .
```

Treat failures as blockers before handing work back. Report warnings when they affect the current task, especially missing review gates, broken links, required section gaps, stale paths, or unresolved placeholders.

## Plan Workflow

Create or update a plan when work is multi-step, cross-package, user-visible, risky, or needs durable handoff.

Plans should include:

- Goal
- Definition of done
- Out of scope
- Phases
- Validation
- Manual QA impact
- Changelog impact
- Circuit breakers
- Risks
- Decision-record check

## Checkpoint Workflow

Create a checkpoint after each meaningful plan phase only when phases were actually executed as separate handoff points. If an agent implements a plan end to end in one continuous pass, create one concise checkpoint for the completed plan instead of verbose phase-by-phase checkpoints.

Checkpoints should capture:

- Completed date
- Summary
- Files changed
- Checks run
- Notes and surprises
- Implications for product docs, business rules, decisions, changelog, and future plans
- Follow-ups

## Circuit Breakers

Stop and ask for direction when:

- The same check fails repeatedly without new evidence.
- Required verification cannot run.
- Scope expands beyond the current plan.
- Requirements conflict.
- A security or data-loss risk appears.
- A migration or deployment step is unclear.

## Documentation Sync

Update the workbench when code changes alter:

- Product behavior
- Business rules
- Architecture decisions
- Env vars
- Setup
- Security posture
- Automated checks
- Manual QA expectations
- Release-visible behavior

## Changelog Impact

Plans, checkpoints, and bug-fix records should identify changelog impact with one category:

- `Added`
- `Changed`
- `Fixed`
- `Removed`
- `Security`
- `Operations`
- `QA / Verification`
- `None`

Use `None` for internal-only implementation work, coordination churn, formatting, template updates, or changes with no release communication value.
