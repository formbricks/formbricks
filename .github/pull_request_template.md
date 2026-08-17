<!-- PR title must follow Conventional Commits: https://www.conventionalcommits.org/en/v1.0.0/#summary -->

<!-- Keep it skimmable: bullets over paragraphs, and `<details>` folds for anything a reviewer only
opens on demand (background, file audits, setup steps). Never fold the Coverage table, Open gaps or
Breaking changes — long media inside Coverage may still be folded. -->

<!-- AI agents: no promotional footers, don't advertise yourself or any tool/service (e.g. "Generated
by …"). The model note at the bottom is the one exception. -->

<!-- Complete the line below: `Fixes ENG-<id>`. A bare URL does NOT link the PR — the magic word has
to come first. Use `Ref ENG-<id>` instead if this PR only partly addresses the ticket, so merging
doesn't close it. No ticket? Delete the line and say why. Closing a GitHub issue? Add `Fixes #<number>`.
This line is the only place a magic word belongs: `Fixes ENG-…` written anywhere else in the
description links and closes that ticket too, backticks included.
More: https://linear.app/docs/github -->

Fixes ENG-

## What & why

<!-- Problem first, then the solution, grounded in the diff rather than commit titles. Short enough
to grasp without opening files. -->

## Breaking changes

<!-- REQUIRED. Tick the box below if — and only if — this PR breaks something for API/SDK consumers or
self-hosters. It is breaking if it changes an API/SDK shape or emitted value (e.g. `EN` → `en-US`),
removes or renames an endpoint, route, env var or config key, changes a default or webhook payload, or
needs manual migration action.

The checkbox is the only thing automation reads: ticking it applies the `breaking-change` label, which
feeds the release notes and the self-hoster migration guide. Leave its wording alone — `pr-label-sync.yml`
finds it by that text, and any other checkbox in this section is ignored. Everything underneath is for
humans: ticked → replace "None" with the table below, one row per change, written for an external
integrator; not ticked → keep "None" and say in a line why. -->

- [ ] This PR contains breaking changes

None

<!-- Delete "None" above and use this table when the box IS ticked:
| Change | Before | After | Who's affected | Action required |
| --- | --- | --- | --- | --- |
| `language` field on responses | `EN`, `DE` | `en-US`, `de-DE` | API v1 consumers | Map the new BCP-47 locale codes in your integration |
-->

## Migrations & env

<!-- New or changed env vars, DB migrations and cutover steps — including non-breaking ones, since
this is what a deployer or self-hoster acts on. Write "none". -->

- none

## How this was tested

<!-- REQUIRED. All QA for this change happens here, before review — there is no separate release QA
pass. Don't restate the checks below (lint, typecheck, unit tests, build, Sonar); give the reviewer
what those cannot show. -->

**Coverage**

<!-- One row per behaviour the diff changes: for an automated row name the test or spec (not a count),
how strong that check is, and what you observed. Name the account, plan or flag state where an outcome
depends on it. For UI work, attach the screenshot or screencast that proves it — fold it if long. -->

<!-- "How" uses one of: `unit (red on main)` — fails against the old code, so it proves the bug
existed; `unit (mutation)` — only fails if you break the fix, because the code under test is new;
`unit (guard)` — passes either way, protecting against future regressions; plus `e2e` and `manual`.
Any red-on-main or mutation row must carry the command or the mutated `file:line`, so a reviewer can
rerun it instead of taking the claim on trust. -->

| Behaviour | How | Outcome |
| --- | --- | --- |
|  | unit (red on main) / unit (mutation) / unit (guard) / e2e / manual |  |

**Open gaps**

<!-- Anything you could not verify, and why. Write "none" if there are none — the reviewer's job is
to challenge this list, so an empty one is a claim rather than a formality. -->

- none

**Risks**

<!-- What nearby behaviour could break, and what to re-check if it does. -->

- none

---

<!-- Fill in if an AI agent wrote code or this description; delete the note if none did. -->

> [!NOTE]
> **AI model used** — `<model>`, reasoning effort `<level>`.
