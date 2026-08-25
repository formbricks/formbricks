<!-- Title: Conventional Commits — https://www.conventionalcommits.org/en/v1.0.0/#summary -->

<!-- BUDGET: ≤350 words outside `<details>` folds, fitting on one screen. Lists are ≤3 bullets of
≤20 words, one idea each. Short sentences, plain words, present tense — write for a colleague who
has not read the ticket: user-visible effect first, mechanism second. Anything longer goes in a
fold, so nothing is lost. Never fold Coverage, Open gaps or Breaking changes. -->

<!-- NEVER WRITE — each of these reads as diligence and costs the reviewer a paragraph: blame
archaeology (which commit introduced it, who touched what); a defence of a choice nobody questioned,
or of what you deliberately did not do; commentary on how strong your own tests are; a restatement
of the ticket, or of what CI reports (lint, typecheck, tests, build, Sonar); a path the `Rerun:`
line already carries; bold on more than a phrase or two per section. No promotional footers and no
advertising of yourself or any tool — the agent note at the bottom is the one exception. -->

<!-- Complete the line below: `Fixes ENG-<id>`, or `Ref ENG-<id>` if this PR only partly addresses
the ticket, so merging doesn't close it. The magic word has to come first — a bare URL links
nothing — and this is the only line it may sit on: `Fixes ENG-…` anywhere else, backticks included,
closes that ticket too. No ticket? Delete the line and say why. GitHub issue? `Fixes #<number>`.
More: https://linear.app/docs/github -->

Fixes ENG-

## What & why

<!-- One sentence each, read off the diff rather than the commit titles. Up to 3 bullets after
them, only for what they cannot carry. -->

**Was:** <what was broken, or how it behaved before>

**Now:** <what happens after this PR>

## Where to look

<!-- 1–3 links to the lines carrying the risk, so a reviewer can spot-check the code without
reading all of it: link plus ≤10 words, no prose. Nothing risky? Say so in a line. -->

-

## Breaking changes

<!-- REQUIRED. Tick the box if — and only if — this PR breaks something for API/SDK consumers or
self-hosters: an API/SDK shape or emitted value (`EN` → `en-US`), a removed or renamed endpoint,
route, env var or config key, a changed default or webhook payload, or a manual migration step.
The tick alone drives the `breaking-change` label, which feeds the release notes and the
self-hoster migration guide, so leave its wording alone — `pr-label-sync.yml` matches that text and
never reads the prose. Ticked → replace "None" with one row per change, written for an external
integrator: `| Change | Before | After | Who's affected | Action required |`. Not ticked → keep
"None" and say why in a line. -->

- [ ] This PR contains breaking changes

None

## Migrations & env

<!-- New or changed env vars, DB migrations, cutover steps — including non-breaking ones, since a
deployer acts on them. Write "none". -->

- none

## How this was tested

<!-- REQUIRED. All QA for this change happens here, before review — there is no separate release QA
pass. `Rerun:` carries the command once, so no row below repeats it. -->

Rerun: `<one command covering the table below>`

**Coverage**

<!-- ≤6 rows, one per behaviour the diff changes; Outcome ≤15 words of what you observed, naming the
account, plan or flag state where it matters. `How` is one of `unit (red on main)`,
`unit (mutation)`, `unit (guard)`, `e2e`, `manual` — AGENTS.md defines them and says how to pick the
cheapest level that can fail. Give a `file:line` only where a row differs from `Rerun:`. UI work
attaches the screenshot or clip, folded if long. More behaviours than rows? Group and fold the
rest. -->

| Behaviour | How | Outcome |
| --- | --- | --- |
|  |  |  |

**Open gaps**

<!-- ≤3 bullets: what you could not verify, and why. The reviewer's job is to challenge this list,
so "none" is a claim rather than a formality. -->

- none

**Risks**

<!-- ≤3 bullets: what nearby behaviour could break, and what to re-check if it does. -->

- none

---

<!-- Delete if no agent was involved. Read both values out of the tool, never from memory — AGENTS.md
says where each tool reports them. -->

> [!NOTE]
> **AI model used** — `<model>`, reasoning effort `<level>`.
