---
name: pr
description: Write the pull request body by filling `.github/pull_request_template.md`. Use when opening, updating or readying a PR, and before the first edit of a change to how a UI surface looks.
---

# pr

The template owns the shape of the body; this skill owns how each section gets filled. The reviewer
decides from the body whether to trust the diff, so every line is **evidence** or **danger**, read off
the diff and the checks you actually ran.

## Inputs

- The diff against the merge-base with `main`, and the Linear ticket it serves.
- What you verified, and how. Claim only checks you ran, and list the ones still pending under Open gaps.
- For a UI change: the before screenshot, taken before the first edit. Read [SCREENSHOTS.md](SCREENSHOTS.md)
  *now* if you have not edited yet; afterwards the before shot costs a stash and a rebuild.

## Procedure

### 1. Review before you write

Run the `code-review` skill against the merge-base. Every Standards and Spec finding is fixed or listed
under Open gaps before the body is written, as "The Review Gate" in `CODING_STANDARDS.md` sets out. An
Open gaps entry that holds a blocking finding starts with `Blocking:`, so the reviewer accepts or rejects it
by name.

### 2. Fill the template

Copy `.github/pull_request_template.md` and fill it top to bottom. Keep every heading and the checkbox
text verbatim: `pr-label-sync.yml` reads the checkbox under `## Merge danger`, and CodeRabbit's
pre-merge checks read the sections by name. Replace every _italic_ placeholder and delete each HTML
comment once its section is filled.

**Ticket line.** `Fixes ENG-<id>`, or `Ref ENG-<id>` when the PR only partly addresses the ticket, so
merging does not close it. A GitHub issue is `Fixes #<number>`; no ticket at all, delete the line and say
why in one sentence. This is the only line a magic word may sit on: Linear and GitHub scan the raw body,
backticks included, so write any other ticket id bare (`ENG-123`).

**What & why.** One sentence each for **Was** and **Now**, user-visible effect first, mechanism second.
Then the smallest visual that makes the point; [VISUALS.md](VISUALS.md) has the menu (pseudocode, call
tree, component tree, file tree, mermaid, shaped `diff`). Up to three bullets after it, only for what the
visual cannot carry.

**Where to look.** One to three links to the lines carrying the risk, each a permalink pinned to the head
commit (`https://github.com/formbricks/formbricks/blob/<head-sha>/<path>#L10-L20`) plus ten words at
most. A link to the PR's Files tab points at nothing. Nothing risky? Say so in one line.

**Merge danger.**

- Tick the breaking-changes box exactly when someone outside this repo has to change something to keep
  working. When the diff touches a public API shape, an env var or config key, a migration, a webhook,
  or the SDK in `packages/js-core`, `packages/survey-ui` or `packages/surveys`, read
  [BREAKING.md](BREAKING.md) before deciding: the tick alone writes the release-notes migration entry.
  Replace the `Why:` placeholder under the box with one sentence on why it is, or is not, breaking;
  a ticked box gets the table from BREAKING.md there instead.
- **Door**: tick exactly one box. Two-way when a revert undoes the change; one-way when it does not (a
  destructive migration, data written in a new shape, a message sent), and then say in the blast
  radius what the revert leaves behind.
- **Blast radius**: what nearby could break and what to re-check if it does, in a phrase.
- **Migrations & env**: every new or changed env var, migration or cutover step, breaking or not,
  since a deployer acts on each.

**Evidence.**

- `Rerun:` carries one command that reruns the table, so no row repeats it.
- One Coverage row per behaviour the diff changes, six at most; fold the rest. `How` is one of
  `unit (red on main)`, `unit (mutation)`, `unit (guard)`, `e2e`, `manual`, defined in
  `CODING_STANDARDS.md` under "Testing Guidelines", which also says how to pick the cheapest level
  that can fail. Every `unit` and `e2e` row names its test or spec, in the row or in `Rerun:`; a
  `mutation` row names the mutated `file:line`. `Outcome` is what you observed in fifteen words, naming
  the account, plan or flag state where it matters.
- A UI change gets a before/after pair per surface, placed under the table:
  [SCREENSHOTS.md](SCREENSHOTS.md). Any other change writes `No UI change`.
- **Open gaps** lists what you could not verify and why, three bullets at most. It is a claim the
  reviewer challenges, so `none` means you checked. A failure you call pre-existing or noise names the
  run on `main` that shows it; without one it goes here. One you call flaky names its Linear issue here
  (see "Flaky tests" in `docs/agents/pull-requests.md`); several flaky issues share one bullet.

All QA for the change happens in this PR, before review; there is no separate release QA pass.

### 3. Cut to one screen

Read the body as a colleague who has not read the ticket. Budget: 350 words outside `<details>` folds.
Lists are three bullets of twenty words at most, one idea each, in short present-tense sentences.
Overflow folds rather than being dropped: long command logs and Coverage rows past the sixth go into
`<details>`, while the Coverage table, Open gaps and the breaking-changes box stay visible.

Spend every sentence on the change, its danger or its evidence. These are the usual padding; cut them:

- Blame archaeology: which commit introduced the bug, who touched what.
- A defence of a choice nobody questioned, or of what you deliberately left out.
- Commentary on how strong your own tests are.
- A restatement of the ticket, or of what CI already reports (lint, typecheck, tests, build, Sonar).
- Bold on more than a phrase or two per section, and footers advertising a tool or agent.

### 4. Publish, arm auto-merge, keep it current

Pass the body from a file (`--body-file`, or the MCP tool's `body`), never through shell quoting.

Once the PR is ready for review (not a draft), enable auto-merge (`enable_pr_auto_merge`, or
`gh pr merge --auto`). `main` has a merge queue, so this queues the PR once the required checks and
reviews pass, and the queue squashes it whatever method the tool reports. If GitHub refuses, say why in
your report rather than merging by hand.

Rewrite the body with every scope change or review fix, so it always describes the head commit.

**Backport to `release/*`.** That branch runs its own copy of `pr-label-sync.yml`, which reads the
checkbox under `## Breaking changes`. Until the branch carries the new workflow, name the heading
`## Breaking changes` instead of `## Merge danger` in a backport body.

## Done when

- Every template heading is present with the checkbox text verbatim, exactly one door box is ticked,
  and no template comment or placeholder is left.
- Every behaviour the diff changes has a Coverage row or an Open gaps entry.
- A UI change has a before/after pair whose URLs load logged out; any other change says `No UI change`.
- The body fits the budget, and every claim matches a check you ran on the head commit. A "covered by"
  or "none" claim names a test you opened, or a search that came back empty.
- A PR marked ready has auto-merge enabled, or your report says why it is not.

## Guardrails

Writing the body does not authorize publishing it: open or update the PR only when the user or the
workflow asked for one. Never invent a screenshot, a test result or an approval.
