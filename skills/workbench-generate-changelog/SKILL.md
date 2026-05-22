---
name: workbench-generate-changelog
description:
  Use when the user asks to generate, update, draft, or compare a CHANGELOG.md or release notes from .specs, planning
  docs, milestones, checkpoints, bug-fix records, decisions, business rules, manual QA, checks, security, env, setup, or
  other spec-based project records. Produces a prepend-only, non-destructive dated changelog block in product/spec
  language instead of summarizing commit messages.
---

# Workbench Changelog Generator

Generate or update a root `CHANGELOG.md` from planning-spec changes. Prefer product/spec language over commit-message
language.

## Workbench Layout

Treat the planning root as the workbench root. In this repository that is `workbench/`.

- Workflow guide: `<workbench-root>/GUIDE.md`
- Durable product/spec records: `<workbench-root>/blueprint/`
- Milestones: `<workbench-root>/blueprint/MILESTONES.md` and `<workbench-root>/blueprint/milestones/`
- Plans, checkpoints, bug fixes, prompts, and templates: `<workbench-root>/cowork/`
- Bug-fix index: `<workbench-root>/cowork/BUG_FIXES.md`
- Research notes and reference assets: `<workbench-root>/research/`

## Workflow

1. Preserve git index state. Do not stage, unstage, commit, amend, reset, or discard files unless explicitly asked.
2. Resolve the planning root:
   - Use the root named by the user when provided.
   - Otherwise prefer a directory with `GUIDE.md` and `blueprint/MILESTONES.md`.
   - Check common roots in this order: `workbench/`, `.specs/`, `docs/`, `project-specs/`, `.agents/specs/`, `ai/`.
   - If multiple plausible roots exist, choose the one whose `GUIDE.md` describes the active workflow or ask when the
     answer is not clear.
3. Resolve the comparison range:
   - Use explicit base/target refs from the user when provided.
   - Otherwise use the latest reachable tag to `HEAD`.
   - Otherwise use `origin/main...HEAD`.
   - Otherwise use `main...HEAD`.
   - If no base can be resolved, ask for a base ref.
4. Gather evidence with read-only Git commands:
   - `git diff --name-status <base>...<target> -- <workbench-root>`
   - targeted `git diff <base>...<target> -- <changed-spec-paths>`
   - `git show <ref>:<path>` when the before/after shape is easier to inspect separately
5. Read changed spec records in tiers:
   - Start from the `git diff --name-status` path list.
   - Read only changed files and directly linked source records needed to understand the release impact.
   - Prefer explicit `Changelog Impact` fields in changed plans, checkpoints, and bug-fix records before opening broader
     specs.
   - Use `rg` on changed paths for `Changelog Impact`, `Fixed`, `Security`, `Operations`, `QA / Verification`, and
     similar markers.
   - Do not bulk-read the whole planning root, every checkpoint, or every decision.
6. Draft a changelog block from spec evidence, not from commit messages.
7. Update root `CHANGELOG.md` using the prepend-only contract below.

## What To Include

Include meaningful changes that affect users, operators, product behavior, domain rules, security posture, setup/env
requirements, QA expectations, defect outcomes, release checks, or agent/human handoff state.

Prefer explicit `Changelog Impact` fields when present in plans, checkpoints, and bug-fix records. Otherwise infer from
the changed specs and cite the source file.

Use these sections only when they have content:

- `Added`
- `Changed`
- `Fixed`
- `Removed`
- `Security`
- `Operations`
- `QA / Verification`

Each bullet should be concise, readable to a mixed internal audience, and link to the source spec record when possible.

Do not include:

- coordination-board churn
- template-only edits
- pure formatting
- internal refactors with no behavior, operation, QA, or release impact
- noisy status/date-only changes
- raw commit messages

## Prepend-Only Update Contract

`CHANGELOG.md` lives at the project root.

Use a dated block:

```markdown
## YYYY-MM-DD
```

If the user provides a version, milestone, or release label, use:

```markdown
## YYYY-MM-DD - <label>
```

When `CHANGELOG.md` does not exist, create it with:

```markdown
# Changelog

## YYYY-MM-DD

### Added

- ...
```

When `CHANGELOG.md` already exists:

- preserve all existing content exactly except for inserting the new block
- insert after the top `# Changelog` title and any short intro directly below it
- insert before the first existing `## ` changelog entry
- do not rewrite, reorder, deduplicate, merge, or clean up older entries unless the user explicitly asks
- when generating another chunk on the same date, create a new dated block instead of merging into the existing block

If there are no meaningful changelog entries, do not edit `CHANGELOG.md`; report that the spec diff had no
release-relevant changes.

## Final Response

Report:

- `CHANGELOG.md` created, updated, or left unchanged
- comparison range used
- planning root used
- number of entries added by section
- any source specs that looked relevant but were intentionally omitted as noise
- checks run, if any

Keep the response concise. Do not paste the full changelog unless the user asks.
