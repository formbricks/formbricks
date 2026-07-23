<!-- PR title must follow Conventional Commits: https://www.conventionalcommits.org/en/v1.0.0/#summary -->

## What & why

<!-- What changed and why, grounded in the actual diff (not commit titles). Lead with the
problem, then the solution. Keep it tight — a reviewer should get the change without opening files. -->

## Linear ticket

<!-- Most PRs implement a Linear ticket — paste its full URL
(e.g. https://linear.app/formbricks/issue/ENG-1234/...) so it auto-links. No ticket? Say why.
Closing a GitHub issue instead? Add "Fixes #123". -->

## How this was tested

<!-- REQUIRED. What you ACTUALLY did to verify this change — past tense, real results, not "how one
could test it". Include: automated tests run and their result (e.g. `pnpm test` ✅), tests you
added/updated, and any manual verification with its outcome. If something couldn't be tested, say why. -->

-

<!-- REQUIRED for any visual/UI change: attach before/after screenshots or a screen recording
(Loom / .gif / .mov). A UI PR without visual proof will be sent back. -->

## QA / Test Plan

<!--
Source of truth for release QA — the QA checklist is built from this, so write it for a tester who
doesn't know the code. Describe the PR's ACTUAL behavior click-by-click. Omit a subsection only when
it genuinely does not apply. Flag any inferred specifics (thresholds, rate limits, timeouts) for
human verification.
-->

**How to test** <!-- happy path first, then edge cases (boundaries, negative input, permissions) -->

- [ ] Step → expected result (include route, error code, and any env flag/var)
- [ ] Edge case → expected result

**Preconditions / test data** <!-- accounts, seed data, feature flags, plan/entitlement, Cloud vs self-host -->

-

**Risks & regressions** <!-- what nearby behavior could break; what to re-check -->

-

**Migrations / env / cutover** <!-- new/changed env vars (diff .env.example), DB migrations, cutover steps; write "none" if none -->

- none
