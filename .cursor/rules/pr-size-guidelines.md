# PR Size Guidelines

## Overview
This rule enforces best practices for keeping pull requests small, reviewable, and maintainable.

## Guidelines

### 🧩 Writing Smaller PRs

**Why Smaller PRs Matter**

Large pull requests are harder to review, increase the chance of merge conflicts, and slow down release velocity. Smaller PRs lead to faster feedback, cleaner merges, and higher code quality. The goal isn't fewer lines for the sake of it — it's focused, testable changes.

### 1. Split Work into Self-Contained Tasks

Before starting your work, split it into small, self-contained tasks.
A task is self-contained if it:

- Can be started, finished, and tested in a single PR.
- Doesn't depend on unfinished work.
- Can be reviewed independently without requiring other merges.

### 2. Keep PRs Reviewable in Size

**Aim for a few hundred lines of actual code per PR** — this is a healthy size for a thoughtful review.

**What doesn't count toward PR line count:**
- Refactors and formatting changes
- Language file updates (locales/*.json)
- Test files (*.test.ts, *.spec.ts, *.test.tsx, etc.)
- Lock files (pnpm-lock.yaml, package-lock.json)
- Generated files

**Recommended threshold:** ~300-500 lines of actual code changes

**Example:** Internal issue #747 was split into 7 PRs — and even then, could have been sliced smaller.

### 3. Handle Dependencies Without Blocking Reviews

To avoid review bottlenecks:

- If you finish your PR but are blocked waiting for review, create your next branch off the PR branch.
- Open a draft PR for the next task, and add a comment noting it's waiting for the previous PR to merge.

This keeps your momentum going while keeping the dependency chain clear to reviewers.

### 4. When Large PRs Are Unavoidable

Sometimes, big PRs are necessary — e.g., dependency updates, migrations, or major refactors.
In those cases:

- Communicate clearly in the PR description.
- Use commits or sections to separate logical changes.
- Add context (screenshots, diagrams, etc.) to aid reviewers.

## Enforcement

A pre-push hook checks the size of your changes and warns you if the PR is getting large. The hook:

- ✅ Counts actual code changes (additions + deletions)
- ❌ Excludes test files, locale files, lock files, and generated files
- ⚠️  Warns at 500 lines, strong warning at 800 lines
- 🚫 **Does not block your push** — you can proceed if needed

## AI Assistant Behavior

When reviewing code or creating PRs:

1. **Proactively suggest splitting large changes** into multiple PRs
2. **Identify natural boundaries** where code can be split (by feature, module, or component)
3. **Help create a sequence of PRs** that build on each other when dependencies exist
4. **Remind about test files** not counting toward the limit
5. **Ask before implementing** if the planned change seems like it will be large

