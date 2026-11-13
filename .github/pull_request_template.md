<!-- Title: Conventional Commits — https://www.conventionalcommits.org/en/v1.0.0/#summary -->

<!-- BUDGET: ≤350 words outside `<details>` folds — one screen. Lists are ≤3 bullets of ≤20 words,
one idea each; the Evidence table is ≤6 rows. Short sentences, plain words, present tense, written
for a colleague who has not read the ticket: user-visible effect first, mechanism second. Overflow
folds rather than being dropped. Evidence, Open gaps, Merge Danger and Breaking changes stay visible;
only long command logs, media past the first pair, and Evidence rows past the sixth fold. -->

<!-- NEVER WRITE — each of these reads as diligence and costs the reviewer a paragraph: blame
archaeology (which commit introduced it, who touched what); a defence of a choice nobody questioned,
or of what you deliberately did not do; commentary on how strong your own tests are; a restatement
of the ticket, or of what CI reports (lint, typecheck, tests, build, Sonar); a path the `Rerun:`
line already carries; bold on more than a phrase or two per section. No promotional footers and no
advertising of yourself or any tool — the agent note at the bottom is the one exception. -->

<!-- Complete the line below: `Fixes ENG-<id>`, or `Ref ENG-<id>` if this PR only partly addresses
the ticket, so merging doesn't close it. The magic word comes first; a bare URL links nothing.
This is the only line it may sit on — `Fixes ENG-…` anywhere else, backticks included, closes that
ticket too. No ticket? Delete the line and say why. GitHub issue? `Fixes #<number>`.
More: https://linear.app/docs/github -->

Fixes ENG-

## Summary

<!-- Skill: `pr`. One sentence each for Was and Now, read off the diff rather than the commit titles.
Then the smallest picture that carries the point: pseudocode for logic, a call tree for runtime
flow, a component tree for UI, a file tree for a refactor, a `diff` sketch when the shape already
exists. Link the 1–3 lines carrying the risk (link plus ≤10 words). No picture helps? Skip it. -->

**Was:** `<what was broken, or how it behaved before>`

**Now:** `<what happens after this PR>`

```text
<pseudocode, call tree, component tree, or diff sketch>
```

## Evidence

<!-- REQUIRED. All QA for this change happens here, before review — there is no separate release QA
pass. `Rerun:` carries the command once, so no row below repeats it. -->

Rerun: `<one command covering the table below>`

<!-- ≤6 rows, one per behaviour the diff changes. `How` is one of `unit (red on main)`,
`unit (mutation)`, `unit (guard)`, `e2e`, `manual` — CODING_STANDARDS.md defines them and says how to
pick the cheapest level that can fail. `Before → After` is what you observed, ≤15 words, naming the
account, plan or flag state where it matters. For a test row, show the test as pseudocode: the
assertion that fails on main and passes now. Every `unit` and `e2e` row names the test or spec it
rests on, in the row or in the `Rerun:` line. A `red on main` row names its own command where that
differs from `Rerun:`; a `mutation` row names the mutated `file:line`. UI work: attach the before and
after screenshots or the clip here, fold anything past the first pair. -->

| Behaviour | How | Before → After |
| --- | --- | --- |
|  |  |  |

**Open gaps**

<!-- ≤3 bullets: what you could not verify, and why. The reviewer's job is to challenge this list,
so "none" is a claim rather than a formality. -->

- none

## Merge Danger

<!-- One-way door: hard to walk back — a destructive migration, a published API or SDK shape, data
rewritten in place. Two-way door: revert the PR and nothing is left behind. Blast radius is one
word for how far it reaches (a screen, a flow, every self-hoster, SDK consumers). One or two lines
on what nearby behaviour could break, and what to re-check, are optional. -->

**Door:** `<one-way | two-way>`

**Blast radius:** `<one word>`

## Breaking changes

<!-- REQUIRED. Tick the box below if — and only if — this PR breaks something for API/SDK consumers or
self-hosters. The test is whether someone outside this repo has to change something to keep working.

**Breaking:** renaming, removing or retyping a field in a public API request or response shape,
requiring one that was optional, or changing an emitted value (e.g. `EN` → `en-US`); removing or
renaming an endpoint, route, env var or config key; changing a default, a webhook payload, or the
HTTP status code returned for an existing case; adding an env var or config key that is required, or
whose default does not keep existing installs working; changing an exported signature of the SDK
shipped from `packages/js-core`, `packages/survey-ui`, or `packages/surveys`; or needing manual
action on upgrade, including a migration that drops or renames a column or table.

**Not breaking:** anything purely additive, and anything internal. Adding an optional field to a
request or response, a new endpoint or route, or an env var whose default keeps existing installs
working leaves every existing consumer working unchanged. So does any change to internal code —
functions, modules, types, workspace-package exports other than the SDK surface above — that no
external consumer reaches, additive or not: "internal API" means internal to this repo, and this
section is not about it. Nor is a change to a shape no published release contains yet: nothing above
is public until a release (prerelease included) ships it, so there is no consumer to break and no
upgrade step to document — rename or delete it and fix its callers.

Uncertain? That means the change isn't clearly one of the bullets above — leave it unticked and say
why below. If it does match a bullet, tick it regardless of how you feel about it: the tick is the
only thing that writes a migration entry, so ticking it "to be safe" when nothing above applies
invents an upgrade step for self-hosters that does not exist; a reviewer who disagrees can still ask
for it.

The checkbox alone drives the label: ticking it applies `breaking-change`, which feeds the release notes
and the self-hoster migration guide. Leave its wording alone — `pr-label-sync.yml` finds it by that text,
ignores every other checkbox in this section, and never reads the prose. What you write underneath is
still read: by reviewers, and by the CodeRabbit "Breaking changes match the diff" check, which compares
the tick against the diff and expects a ticked box to be explained. Ticked → replace "None" with the
table below, one row per change, written for an external integrator; not ticked → keep "None" and say in
a line why. -->

- [ ] This PR contains breaking changes

None

<!-- Delete "None" above and use this table when the box IS ticked:
| Change | Before | After | Who's affected | Action required |
| --- | --- | --- | --- | --- |
| `language` field on responses | `EN`, `DE` | `en-US`, `de-DE` | API v1 consumers | Map the new BCP-47 locale codes in your integration |
-->

## Migrations & env

<!-- New or changed env vars, DB migrations, cutover steps — including non-breaking ones, since a
deployer acts on them. Write "none". -->

- none

---

<!-- Delete if no agent was involved. Read both values out of the tool, never from memory; a value the
tool does not expose is `unknown`, never a guess. `docs/agents/pull-requests.md` says where each tool
reports them. -->

> [!NOTE]
> **AI model used** — `<model>`, reasoning effort `<level>`.
