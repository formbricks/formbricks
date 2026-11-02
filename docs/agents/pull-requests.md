# Commit & Pull Request Guidelines

Read before committing, or opening, updating, or reviewing a pull request.

## Commits

Use Conventional Commits (`fix:`, `chore:`, `feat:`), keep commits scoped, and run the relevant checks.
The rule against publishing agent session links lives in `AGENTS.md` and applies to every commit.

## Pull requests

Read `.github/pull_request_template.md` and follow its inline guidance when opening or updating a PR.
It owns the structure, word budget, ticket syntax, coverage evidence, breaking-change decision, and
migration/env reporting. Update the description with every scope change or review fix.

Complete QA on the change's PR before requesting review. The author accounts for each changed behavior
and names unverified behavior under Open gaps; reviewers challenge that evidence. Release review checks
interactions between changes rather than repeating each PR's QA.

## Reviews

Pin the PR head and base SHAs before reviewing. Collect inline threads, submitted review bodies
(including findings outside the diff), and conversation comments. Keep a compact record of each
actionable finding's source link, reviewed commit, and disposition: still applies, addressed, or not
applicable, with evidence from the pinned diff. A resolved thread or an older passing review does not
establish coverage of the current head; report paused or stale automated reviews separately from CI.

Fetch each discussion source once and retain the structured result. Surface actionable text and source
links first; expand supporting logs or bot analysis only when needed to assess a finding.

For the `code-review` skill's Standards and Spec passes, start each reviewer in a fresh context with
the same pinned diff and its own brief and sources. Give it relevant review findings to verify, with
their provenance. Collect both reports before sharing either reviewer's conclusions with the other.

When changing workflow checks, validate against the PR merge result as well as the branch head. The
lint workflow checks the event's merge snapshot before application linting; merge-group runs repeat
the check against the queued integration commit.

## Sonar

SonarCloud project `formbricks_formbricks`; its API is public, no token needed.

- Open issues for PR `<N>`: `https://sonarcloud.io/api/issues/search?componentKeys=formbricks_formbricks&pullRequest=<N>&resolved=false&ps=100`.
- Is the analysis current: compare the PR's `commit.sha` from `https://sonarcloud.io/api/project_pull_requests/list?project=formbricks_formbricks` with the branch head. The issue list shows the last analysed commit until a newer analysis lands.
- Analysis trails the push by about 15 minutes and runs only in the PR workflow. A PR with merge conflicts gets no `pull_request` runs (no merge result), so Sonar and CI stay on an older commit until the conflict is resolved.
- A passing quality gate allows open issues; read the list.
- The pre-commit lint mirrors Sonar's rules for staged files (`packages/config-eslint/sonar-parity.mjs`), so a new violation fails the commit instead of a later review.

## CI failure triage

Take failing test names from the `blacksmith-sh` bot's comment on the PR. Otherwise list the run's jobs
(`actions_list`, `list_workflow_jobs`), find the failing step, and fetch the job log with a `tail_lines` of a
few hundred. The E2E log is dominated by SpiceDB gRPC output (once a single 2.4 MB line), so filter a saved
log with `grep -v grpc` before reading it. `release/*` branches keep their own workflow copy, where a red
`PR Check Summary` can come from cancelled jobs of a superseded push; check the job conclusions first.

## Agent attribution

The agent note names the exact model id the vendor serves — `claude-opus-5`, `gpt-5.1-codex` — not the harness it runs in; Claude Code, Codex CLI and Cursor are harnesses, so name one in parentheses only when it adds something (`claude-opus-5 (Claude Code 2.1.237)`). The reasoning level is whatever knob that vendor exposes, in its own units: an effort level (`max`, `high`), a thinking budget (`32k tokens`), or `n/a`. Read both out of the tool, never from memory — Claude Code reports them in `/status` or as the session's `model` and `effort_level`, Codex CLI in `/model` or its startup line. A value you cannot look up is `unknown`, never a guess and never the harness name standing in for the model.
