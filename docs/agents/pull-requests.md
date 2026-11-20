# Commit & Pull Request Guidelines

Read before committing or reviewing a pull request.

## Commits

Use Conventional Commits (`fix:`, `chore:`, `feat:`), keep commits scoped, and run the relevant checks.

## Pull requests

Writing the PR body is the `pr` skill's job (`.agents/skills/pr`); this file covers what surrounds it.

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

- `scripts/sonar-pr-issues.sh <N>` prints both of the next two: the analysed commit and the open issues.
- Open issues for PR `<N>`: `https://sonarcloud.io/api/issues/search?componentKeys=formbricks_formbricks&pullRequest=<N>&resolved=false&ps=100`.
- Is the analysis current: compare the PR's `commit.sha` from `https://sonarcloud.io/api/project_pull_requests/list?project=formbricks_formbricks` with the branch head. The issue list shows the last analysed commit until a newer analysis lands.
- Analysis trails the push by about 15 minutes and runs only in the PR workflow. A PR with merge conflicts gets no `pull_request` runs (no merge result), so Sonar and CI stay on an older commit until the conflict is resolved.
- A passing quality gate allows open issues; read the list.
- `pnpm lint` mirrors Sonar's rules (`packages/config-oxlint/sonar-parity.mjs`), so a new violation fails lint instead of a later review. Cognitive complexity, which existing code still exceeds, is checked on the staged lines only, by the pre-commit hook.

## CI failure triage

Take failing test names from the `blacksmith-sh` bot's comment on the PR. Otherwise list the run's jobs
(`actions_list`, `list_workflow_jobs`), find the failing step, and fetch the job log with a `tail_lines` of a
few hundred. The E2E log is dominated by SpiceDB gRPC output (once a single 2.4 MB line), so filter a saved
log with `grep -v grpc` before reading it. `release/*` branches keep their own workflow copy, where a red
`PR Check Summary` can come from cancelled jobs of a superseded push; check the job conclusions first.

## Flaky tests

A flaky test is a bug, and every PR that runs into it pays for it, so it is filed at once and fixed next.
A test is flaky when it fails and then passes on a rerun of the same commit, or when the E2E job log's
Playwright summary counts it as `flaky` (it passed only on Playwright's own retry). The second kind hides
inside green runs, so read the summary even when the check passed.

1. One rerun is how you find out. Once it shows a flake, rerun nothing more until steps 2–3 are done.
2. Search Linear, closed issues included, for the test name. When nothing asserted (an action timeout, a
   hook or fixture that throws), also search for the error and the line it came from: a shared fixture
   can fail the same way in other tests. Reuse an issue only when it records the same failure: the
   failing assertion, or that error and line. A different failure is a different flake. An open issue
   gets the new run ids (or for a local run the command and its output), plus this test's name if it is
   missing. A Done or Canceled one is reopened with them: its fix did not hold.
3. Otherwise file one as `docs/agents/issue-tracker.md` describes (no project or milestone needed):
   priority High, label `bug`, plus `infrastructure` when the cause is CI or the test harness rather than
   the product. Give the failing test, that failure, and the runs it failed in (or the local command and
   output), marked "first seen" if this is the first.
4. Name the issue under the PR's Open gaps, whether or not the PR touches that test. Fix it next, in its
   own PR, unless the user redirects you. How to fix one is in `CODING_STANDARDS.md`, "Testing
   Guidelines".
