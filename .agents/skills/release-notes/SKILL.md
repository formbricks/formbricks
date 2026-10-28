---
name: release-notes
description: >-
  Draft the GitHub release notes for a Formbricks release from the diff between the previous stable
  tag and the release branch — in the exact "What's Changed" format past releases already use
  (grouped by conventional-commit type, one bullet per PR carrying its verbatim title, author handle
  and full PR URL), with an Overview, a Breaking changes index that links the migration guide, and a
  Security credits section carrying opted-in reporter credits. Replaces the plain GitHub
  "auto-generate release notes" button, which dumps a flat list, double-lists every backport, and
  handles neither breaking changes nor credits. Use for "/release-notes", "generate release notes",
  "draft the release notes for x.y", or Release QA Step 11 (Ship the stable release).
compatibility: Requires a git checkout of formbricks/formbricks, an authenticated gh CLI, and the
  Linear MCP for security-credit cross-checks (skippable if no security fixes shipped this release).
metadata:
  owner: Dhru
  argument-hint: "[previous-version] [new-version]"
  when-to-use: >-
    "/release-notes", "generate release notes", "/release-notes 5.4.3 6.0.0", "draft the release notes", "what should go in the GitHub release", or when running Release QA Step 11 and it's time to create the stable GitHub release.
---

# Draft the GitHub release notes

Takes two versions, scopes the diff, groups every merged PR, compiles breaking changes into an
index that links the migration guide, carries in opted-in security-reporter credits, and creates a
**draft** GitHub release — never published, so a human always makes the final call.

## Inputs

Ask first; do not assume.

Ask for both before doing anything else, even if `$ARGUMENTS` looks complete:

> 1. **Previous version** to diff against — e.g. `5.4.3`. The last *stable* tag, not an rc.
> 2. **New version** for this release — e.g. `6.0.0`.

Derive `RELEASE_BRANCH` from the new version (`6.0.0` → `release/6.0`) and **confirm it exists**
(`git ls-remote --heads origin`). If it does not, ask — some releases are cut from `main`.

Then, before scoping anything, re-check the tag list. Release state moves between sessions:

```shell
git fetch origin --tags
gh release list --limit 8      # which tag is actually "Latest"? any new rc?
git log --oneline -1 origin/$RELEASE_BRANCH
```

A stable patch on the *older* line can ship **after** the rc you were working from — 5.4.3 landed
after 6.0.0-rc.5. That moves the baseline, so never reuse a PR list computed in an earlier session
without re-running this check.

## Procedure

### Scoping the diff

#### Two-dot, never three-dot

```shell
git log --format="%s" $PREVIOUS_TAG..origin/$RELEASE_BRANCH
```

Three-dot diffs against the merge-base, so anything backported into the older line is reported as
new work. In the 5.4 round that invented three phantom PRs and inflated the file count 945 → 993.

`$PREVIOUS_TAG` is usually **not** an ancestor of the release branch — the two lines diverge once
the older line keeps taking its own backports. Check, but do not change the command on the answer;
two-dot is right either way:

```shell
git merge-base --is-ancestor $PREVIOUS_TAG origin/$RELEASE_BRANCH && echo ancestor || echo "NOT an ancestor"
```

#### Do not pass `--no-merges`

Backport PRs into a release branch land as **merge commits whose second parent is the original
`main` commit**, so the range contains *both* PR numbers for one change. `--no-merges` silently
drops the backports whose original never entered the range, which is the one case where the
backport PR is the only representation of that work. Take every commit, then dedup explicitly.

#### Dedup backport pairs

```shell
git log --format="%s" $PREVIOUS_TAG..origin/$RELEASE_BRANCH \
  | grep -oE "backport #[0-9]+ to release/[0-9.]+\) \(#[0-9]+\)" \
  | sed -E 's/backport #([0-9]+) to release\/[0-9.]+\) \(#([0-9]+)\)/\1 \2/' | sort -un
```

For each `original backport` pair: if the original is **also** in the PR list, drop the backport
entry and keep the original. If it is not, keep the backport entry — it is the only representation.
In the 6.0 run this was 11 dropped out of 16 pairs, 201 PRs → 190 entries.

#### Flag work that already shipped on the older line

A PR can be in the range and still be old news to anyone upgrading from `$PREVIOUS_TAG`, because
the same change was backported to the previous minor. This matters most for **breaking** changes —
listing one as new invents an upgrade step that the reader already performed:

```shell
git log --oneline origin/release/PREVIOUS-MINOR --grep="#PR-NUMBER"
```

Do not delete these from "What's Changed" (they are genuinely in the range), but move them out of
the Breaking changes index into a short "Coming from the older minor or earlier" note. 6.0's case:
#8986 (Valkey multi-arch), which had already shipped in 5.4.0.

### Fetching PR data

One `gh pr view` per PR does not scale — 6.0 had 201. Batch through GraphQL, 40 aliases per query:

```shell
gh api graphql -f query="query {repository(owner:\"formbricks\",name:\"formbricks\"){
  p8971: pullRequest(number:8971){number title body author{login} mergedAt labels(first:20){nodes{name}}}
  ...
}}" --jq '.data.repository | to_entries[] | .value' | jq -c .
```

Write one JSON object per line to a scratch file and query it with `jq` from then on. Two notes:
macOS ships bash 3.2, so `mapfile` does not exist — loop with `for` / `while read`. And `gh api
graphql --jq` pretty-prints, so pipe through `jq -c .` to keep it newline-delimited.

### Grouping — house style, verbatim titles

Look at a recent stable release before composing (`gh release view 5.4.0 --json body -q .body`).
The format below is what the team already publishes; the point is to keep that shape while adding
what the auto-generate button cannot do.

Group by the conventional-commit prefix on the PR title. One section per type, in this order, and
only for types with at least one PR:

`🚀 Features` → `🐛 Fixes` → `🔧 Refactors` → `⚡ Performance` → `📚 Docs` → `⚙️ CI` → `🧹 Chores`

A `ci` **scope** goes to CI, not to its prefix's section: `fix(ci):` and `chore(ci):` both sit
under `⚙️ CI` in past releases. Entries are the PR title **verbatim** — keep the scope, the
`[ENG-…]` id, and a backport's `(backport #N to release/X)` suffix. Never rewrite or merge titles.

There is **no separate Security section** for the fixes themselves — a security fix keeps its
normal grouping and reads like any other entry (`fix(security): bind email-change tokens …`).
Credits are separate; see below.

Every bullet cites the real author and the **full** PR URL. A bare `#1234` only auto-links inside
the same repository, so it renders as dead text anywhere else the notes get pasted.

### Breaking changes

`breaking-change` is the reliable signal: `pr-label-sync.yml` applies it from the template
checkbox, and in the 6.0 run label and tick agreed on all 16 PRs. Verify anyway — the check is
cheap and a mismatch means the label sync broke:

```shell
# labeled
jq -r 'select(.labels.nodes[].name=="breaking-change") | .number' bodies.ndjson | sort -un
# ticked
jq -r 'select((.body//"") | test("(?i)- \\[x\\][ \t]*This PR contains breaking changes")) | .number' bodies.ndjson | sort -un
```

Each labeled PR carries a **Breaking changes** table in its body — that table is the source text,
never written from scratch. But **do not paste the tables into the notes.** House style since 6.0
(Matti, Sep 2026) is an *index*: one line per change, linking its PR, with the procedure left to
the migration guide.

> "Don't we have a migration guide for this that we can link? I think this makes more sense than
> stating everything (again) in the release notes."

So: condense each table row to a single sentence, group the bullets by audience — **self-hosted
deployment**, **API and SDK contract**, **changed defaults and limits** — and link
`/self-hosting/advanced/migration#v6` (adjust the anchor per major) plus any version-specific
upgrade page at the top of the section. Keep API and SDK bullets in the notes even when the
migration guide is linked: that guide is a self-hosting runbook, and a changed HTTP status code or
a removed Management API field has no upgrade step to document there.

If there are none, state **"No breaking changes"** explicitly — Release QA's definition-of-done
requires it stated, not silently omitted.

Two backstops:

- Scan for unlabeled contract changes (public API routes, SDK shapes, webhook payloads, changed
  defaults) the way Release QA Step 4 does, and flag what you find to the human rather than
  silently including or excluding it.
- **Every docs page the notes link must exist on the release branch**, not just on `main`. A docs
  PR merged to `main` after the branch was cut is absent from the branch the release ships from.
  Check with `git cat-file -e origin/$RELEASE_BRANCH:docs/PATH` and offer a backport if missing —
  this is exactly what happened to the release-and-maintenance-policy page for 6.0.

### Security credits

#### Finding them

The source of truth is the **Linear ticket**, not the PR. Since 2026-10-28, every externally
reported vulnerability carries one `Credit:` line per reporter in its `## Security assessment`
block, recorded when the reporter answers in Plain:

```
Credit: <name exactly as they asked> · first report <date> · Plain T-nn
Credit: anonymous
Credit: not requested
Credit: asked <date>, no answer yet
```

Credit stays out of PR descriptions on purpose: `formbricks/formbricks` is public, and a credit line
in a fix PR announces a vulnerability fix before the patch ships.

1. Extract every `ENG-\d+` from the in-range PR titles and bodies.
2. List Linear issues labeled `vulnerability` — **that is the operative label**; `security` is the
   retired duplicate (ENG-2383) still carried by older issues, so check both and union them.
3. Intersect with the PR-referenced ids, then drop every `[Dependabot …]` title — in 6.0 that was
   37 of 57. Dependency bumps get no researcher credit.
4. Read the `Credit:` lines on what survives. Credit every `Credit: <name>` line, in the order
   listed (earliest report first). Skip `anonymous` and `not requested`. A ticket with `asked …,
   no answer yet` is a question for the human before publishing, never a guess.
5. **Older tickets** (before 2026-10-28) have no `Credit:` line. For those, fall back to the old
   scan: a "Reported by" / "Reporter:" / "Plain thread T-nn" line in the ticket description, then
   the PR body —

   ```shell
   jq -r 'select((.body//"") | test("(?i)credit|reported by|disclos|responsible")) | "#\(.number) \(.title)"' bodies.ndjson
   ```

   (6.0 examples: a `## Credit` heading in #8848, a prose line above `## What & why` in #8971, a
   bullet inside `## What & why` in #9255.) ENG-2836, which planned a `## Credit` section in the
   PR template, is superseded by the ticket line.

#### Placement

A **`### 🔒 Security credits` section after the last type-section**, not an inline "reported by"
suffix on the bullet. This is the 5.3.0 and 5.4.0 precedent:

```markdown
### 🔒 Security credits

Thanks to the following researchers, who reported issues fixed in this release through
responsible disclosure:

* [handle](https://github.com/handle) — one-line description of the issue (#PR)
* Name (Org) — one-line description of the issue (#PR)
```

Credit belongs to the **first release that carries the fix**. Before crediting, confirm the fix did
not already ship on the older line (`git log --oneline $PREVIOUS_TAG --grep="#PR-NUMBER"`); if it
did, the credit belonged in that release's notes.

Honour what the reporter asked for, exactly as the `Credit:` line (or, for older tickets, the PR or issue) words it — some ask for a GitHub
handle, some for a real name, some for an employer to be named too ("credit is owed to Google and
Ada Logics"), some explicitly decline. Never invent or infer a name, never credit someone not
explicitly named, and never describe the vulnerability beyond what the PR already made public.

### Overview and the maintenance line

Stable notes open with `## Overview` — a plain-prose lead, written as **unwrapped lines** (one line
per paragraph; hard-wrapped source reads as odd line breaks in the release editor).

It carries three things:

- What the release is, in a sentence or two. User-visible effect first.
- The upgrade path: link the migration guide and any version-specific upgrade page, and name the
  **tested upgrade pair**. The v6 upgrade page warns "Use only an upgrade pair listed as tested in
  the target release notes", so this is load-bearing — **ask the human** what QA actually
  exercised. Never assert a pair you have not been told was tested.
- The support-end date, stated as a date, not a rule: *"receives bug fixes and security fixes until
  **21 December 2026**"*. Per `/self-hosting/advanced/release-maintenance-policy`, a minor is
  maintained for three calendar months from the day its first stable version is published — so this
  needs the intended publish date. Ask if it is not settled.

### Compose

```markdown
## Overview

Prose, unwrapped lines.

## ⚠️ Breaking changes

Link the migration guide and upgrade page, then the grouped one-line bullets.
(or, if there are none: "**No breaking changes**")

## What's Changed

### 🚀 Features

* verbatim PR title by @author in https://github.com/formbricks/formbricks/pull/1234

### 🐛 Fixes
...
### 🔧 Refactors
...
### ⚡ Performance
...
### 📚 Docs
...
### ⚙️ CI
...
### 🧹 Chores
...

### 🔒 Security credits

Only when someone opted in.

**Full Changelog**: https://github.com/formbricks/formbricks/compare/PREVIOUS_TAG...NEW_TAG
```

Omit any type-section with zero PRs — an empty header is worse than no header.

**Nothing else goes in this block.** No meta-commentary, no "here's a gap I found", no confidence
notes, no testing narrative — this text is meant to be publishable as-is. Everything you want to
tell the human (a flagged unlabeled breaking change, an unresolved PR, a missing tested pair) goes
in your own reply, separate from the notes.

### Create as a draft — never publish

```shell
gh release create $NEW_TAG --target $RELEASE_BRANCH --draft --title $NEW_TAG --notes-file NOTES.md
```

Always `--draft`. Publishing is one-way and externally visible: it triggers the Docker/Helm/ECR
release pipeline and moves the `stable` tag. Hand the draft URL over; the user clicks Publish.
Never pass `--latest`, never omit `--draft`.

RCs are different — they keep GitHub's raw auto-generated notes (flat `## What's Changed`, no emoji
sections). Only stable releases get this treatment.

## Done when

- A **draft** GitHub release exists for the new tag, targeting the release branch, never published.
- Its notes follow the Compose shape: no empty type-section, "No breaking changes" stated when there are none, every PR title verbatim with its author and full URL.
- Every docs page the notes link exists on the release branch.
- Security credits match the tickets' `Credit:` lines: every named reporter, in that order, worded as they asked; none left as an unanswered request.
- Everything for the human (an unlabelled contract change, the tested upgrade pair, the support-end date) is in the reply, not in the notes.

## Guardrails

- Ask for the previous and new versions before doing anything; confirm the derived release branch.
- Re-check `gh release list` and tags at the start of every run — the baseline moves between sessions.
- Two-dot ranges only. Never `--no-merges`. Dedup backport pairs explicitly.
- Verbatim PR titles, real authors, full PR URLs. Never a bare `#1234`, never a placeholder author.
- Omit empty type-sections; state "No breaking changes" explicitly when there are none.
- Breaking changes are an index that links the migration guide, not restated tables.
- Check that every docs page the notes link exists on the release branch; offer a backport if not.
- Security credits go in their own `### 🔒 Security credits` section, never inline on the bullet.
- Credits come from the ticket's `Credit:` lines. An unanswered credit request is a question for
  the human, never a guess.
- Never fabricate a reporter's name or credit someone not explicitly named. Honour the exact
  wording they asked for, including any employer.
- Ask the human for the tested upgrade pair and the support-end date. Never assert either.
- The notes block must be immediately publishable — all caveats go in your reply, not in the notes.
- Always `--draft`. Publishing is the user's call.
- No AI/Claude attribution anywhere in the notes, the commits, or any PR this skill opens.
- Keep the frontmatter `description` free of angle brackets — the skill uploader rejects anything
  that parses as an XML tag.
