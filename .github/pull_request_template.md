<!-- PR title must follow Conventional Commits: https://www.conventionalcommits.org/en/v1.0.0/#summary -->

<!-- Keep it skimmable: bullets over paragraphs, and `<details>` folds for anything a reviewer only
opens on demand (background, file audits, setup steps, long media). Never fold Coverage, Open gaps
or Breaking changes. -->

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

<!-- REQUIRED. Leave "None" if nothing changes for API/SDK consumers or self-hosters. It is breaking
if it changes an API/SDK shape or emitted value, removes or renames an endpoint, route, env var or
config key, changes a default or webhook payload, or needs manual migration action. If YES, fill the
table below — it feeds the release notes and the self-hoster migration guide, and applies the
`breaking-change` label automatically. -->

None

<!-- Delete "None" above and use this table when there IS a breaking change:
| Change | Before | After | Who's affected | Action required |
| --- | --- | --- | --- | --- |
| `language` field on responses | `EN`, `DE` | `en-US`, `de-DE` | API v1 consumers | Map the new BCP-47 locale codes in your integration |
-->

## How this was tested

<!-- REQUIRED. All QA for this change happens here, before review — there is no separate release QA
pass. Don't restate the checks below (lint, typecheck, unit tests, build, Sonar); give the reviewer
what those cannot show. -->

**Coverage**

<!-- One row per behaviour the diff changes: how you verified it and what you observed. For UI work,
attach the screenshot or screencast that proves it — fold it if long. -->

| Behaviour | How | Outcome |
| --- | --- | --- |
|  | unit / e2e / manual |  |

**Open gaps**

<!-- Anything you could not verify, and why. Write "none" if there are none — the reviewer's job is
to challenge this list, so an empty one is a claim rather than a formality. -->

- none

**Risks**

<!-- What nearby behaviour could break, and what to re-check if it does. -->

-

---

<!-- Fill in if an AI agent wrote code or this description; delete the note if none did. -->

> [!NOTE]
> **AI model used** — `<model>`, reasoning effort `<level>`.
