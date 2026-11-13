---
name: pr
description: >-
  Own a Formbricks pull request from "before I code" to "PR body written": capture the before
  screenshots, decide which tests the change owes and prove they can fail, then write the PR body
  as a Summary picture, before/after Evidence, and a Merge Danger call. Use for "/pr", "open a PR",
  "write the PR description", "what tests does this need", "add screenshots to the PR", "is this
  test any good", or before implementing a change that touches UI. Read it before implementing,
  not after — the before shot cannot be taken once the change lands.
argument-hint: "[pr-number]"
---

# pr — evidence first, then the body

The PR body is read by a colleague who has not seen the ticket. Show them the change as a picture,
show them it works as a before and an after, and tell them how hard it is to undo. The template at
`.github/pull_request_template.md` owns the structure, the word budget and the ticket syntax; this
skill fills it in.

## Two moments

**1. Before you implement** (skip if the change is already written — see the stash path in
`references/screenshots.md`):

- Visual delta? Take the before shots now. `references/screenshots.md`.
- Decide which tests the change owes. `references/tests.md`, steps 1 and 2.

**2. When you open or update the PR:**

- Prove each new test can fail. `references/tests.md`, step 4.
- Take the after shots with the identical command.
- Write the body, below.

## Writing the body

Fill the template top to bottom. Skip preambles. Use the domain words from `GLOSSARY.md`.

### Summary

One sentence for **Was**, one for **Now**, read off the diff and not the commit titles. Then the
smallest picture that makes the point:

| The point is… | Draw… |
|---|---|
| logic or a rule | pseudocode |
| runtime control flow | a call tree |
| UI structure | a component tree, with the state and module boundaries that matter |
| a broad refactor | a shallow file tree |
| components or services talking | a Mermaid sequence diagram |
| a change to a shape that already exists | a `diff` sketch of that shape |

One picture is usual, two is the limit. Link the one to three lines that carry the risk, with at
most ten words each. If no picture helps, write the two sentences and stop.

### Evidence

One table row per behaviour the diff changes, at most six. Columns: **Behaviour**, **How**,
**Before → After**.

- **How** is one of `unit (red on main)`, `unit (mutation)`, `unit (guard)`, `e2e`, `manual`.
  `CODING_STANDARDS.md` defines them. Pick the cheapest level that can fail.
- **Before → After** is what you observed, in 15 words or fewer. Name the account, plan or flag
  state where it matters.
- A test row shows the assertion as pseudocode: what fails on main, what passes now.
- A UI row has the screenshot pair or clip beside it. Fold anything past the first pair.
- `Rerun:` carries the one command once. A `red on main` row names its own command where it
  differs. A `mutation` row names the mutated `file:line`.

Ranking, best first: a screenshot pair for a visual change, then a test that was red on main and is
green now, then a mutation or guard test, then a manual check you describe. If you could not verify
a behaviour, it goes under **Open gaps** with the reason. "None" is a claim, so mean it.

Non-visual and no behaviour change (CI, tooling, docs, tests)? Write one row saying so.

### Merge Danger

- **Door:** one-way if it cannot be walked back — a destructive migration, a published API or SDK
  shape, data rewritten in place. Two-way if reverting the PR leaves nothing behind.
- **Blast radius:** one word for how far it reaches. A screen, a flow, every self-hoster, SDK
  consumers.
- Optional, two lines at most: what nearby behaviour could break and what to re-check.

### The rest

**Breaking changes** and **Migrations & env** follow the template's own rules. They drive the
`breaking-change` label and the release notes, so keep their wording.

## Rules

- No production code is changed to make a test pass. Report it instead.
- Nothing is claimed to pass without having been run.
- Never ship an "after" without a "before".
- Fixture users only in any screenshot. The repo is public.
- Pushing media to `assets-pr-screenshots` is outward-facing and permanent. If the media was not
  asked for, ask first.
- Do not commit, push, or open or update a PR without being asked.
- Update the body with every scope change or review fix.
