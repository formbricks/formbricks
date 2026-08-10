# ENG-1739 — Authorization performance at BI-like scale

Results from running the ENG-1739 tooling (`pnpm authzed:perf`, the per-request check
counter in `apps/web/lib/authorization/context.ts`) against a locally seeded BI-shaped
tenant. This is a snapshot from one machine on one day, not a standing benchmark — see
[Environment and caveats](#environment-and-caveats) before treating any number here as a
production SLO.

## Summary

- **The N+1 claim is proven, not argued.** A workspace's survey list issues exactly **one**
  authorization decision whether the workspace holds 50 surveys or 3,000 — confirmed
  against real Postgres, and mutation-checked (removing the counter call fails the
  assertion, so the test can actually catch a regression).
- **A single authorization decision is cheap**, legacy or SpiceDB: sub-2ms p50, sub-5ms
  p99, on both evaluators, at 6,000 surveys / 2,000 users / 50,000 responses.
- **The first cross-evaluator comparison run was misread, and the correction matters more
  than the original number.** The gap between "legacy" and "SpiceDB" in the first run was
  not the SpiceDB engine, and it was not `fully_consistent` — it was the coordinator's
  pre-check Postgres resolution running with no `reactCache` benefit in a plain script.
  Details in [The correction](#the-correction-what-the-first-comparison-got-wrong).
- **What this does not answer:** a real per-page count under Next.js request caching, and
  behavior at the `large` scale profile (500k responses) or under concurrent load.

## Method

Two tools, run separately per AuthZed's own load-testing guidance — relationships must be
seeded before they're read, never written during the run that measures them:

```bash
pnpm authzed:perf seed --scale=default     # 2,000 users, 100 teams, 50 workspaces,
                                            # 6,000 surveys in one workspace, 50,000 responses
pnpm authzed:backfill --apply --scope=all  # project the seeded rows into SpiceDB
pnpm authzed:perf run --iterations=5000 --concurrency=16
```

`authzed-perf.ts run` drives the real `can()` — real coordinator, real evaluator, real
SpiceDB when enforcement is configured — inside a `withAuthorizationSurface` wrapper (so
the rollout coordinator has a target to match), and reports p50/p95/p99 per action from
5,000 samples weighted toward positive checks and a subset of the seeded users, per
AuthZed's guidance that negative checks are structurally more expensive and an unweighted
sample produces an unrealistic cache profile.

The N+1 claim is separate and does not use the perf harness at all: it drives the real
survey-list code path (`can(..., "workspace.read", ...)` then `getSurveys(workspaceId)`,
exactly what a workspace's survey list page calls) inside the same request-surface
wrapper, and reads `getIssuedAuthorizationCheckCount()` — a counter incremented once inside
`can()` itself, the single point every caller passes through — before and after. See
`apps/web/lib/authorization/checks-per-request.integration.test.ts`.

## Results — single-decision cost, legacy vs SpiceDB

5,000 checks each, same seeded tenant (2,000 users / 100 teams / 50 workspaces / 6,000
surveys / 50,000 responses), concurrency 16, **0 errors on both**.

| Action | Legacy p50 | Legacy p95 | Legacy p99 | SpiceDB p50 | SpiceDB p95 | SpiceDB p99 |
| --- | --- | --- | --- | --- | --- | --- |
| `organization.read` | 0.92 ms | 1.38 | 1.84 | 3.52 ms | 8.12 | 23.68 |
| `organization.manage` | 0.93 ms | 1.41 | 1.87 | 3.52 ms | 8.12 | 23.28 |
| `workspace.read` | 1.37 ms | 2.16 | 3.03 | 3.60 ms | 10.17 | 24.10 |
| `workspace.write` | 1.41 ms | 2.19 | 3.09 | 3.49 ms | 10.00 | 23.84 |
| `survey.read` | 1.99 ms | 2.94 | 4.11 | 3.88 ms | 9.58 | 29.13 |
| `survey.response_export` | 1.97 ms | 2.93 | 4.30 | 3.78 ms | 10.14 | 29.58 |

Throughput: 6,424 checks/sec (legacy) vs 2,580 checks/sec (SpiceDB, `fully_consistent`,
required by env validation whenever enforcement rules are configured — see below).
`allowRate` was **0.21 on both runs** — the two evaluators reached the same decisions on
the same tenant, which is a correctness signal this comparison produced for free.

Read this table for shape, not for an absolute SLO: see
[Environment and caveats](#environment-and-caveats).

## The correction: what the first comparison got wrong

The first pass at this compared the table above and concluded "enforcement's forced
`fully_consistent` consistency mode is 6–13x slower at p99." That conclusion does not
survive isolating the variable, and it shipped in a draft of this document for about an
hour before a second test caught it — worth recording so the mistake doesn't get made
again.

**What actually happened:** the comparison above uses two different code paths end to end
— `can()` routed to the legacy evaluator, versus `can()` routed to the SpiceDB evaluator
under enforcement (which forces `fully_consistent`). That conflates three variables that
were never separately measured: which evaluator answers, whether the coordinator's
pre-check Postgres resolution ran with a warm cache, and the consistency mode.

**Isolating consistency mode alone** — calling the SpiceDB client's `checkPermission`
directly, bypassing the coordinator entirely, at both settings, varying the subject across
200 real seeded users the same way the full run does:

| | minimize_latency | fully_consistent |
| --- | --- | --- |
| p50 | 0.40 ms | 0.49 ms |
| p95 | 1.21 ms | 1.34 ms |
| p99 | 2.02 ms | 1.94 ms |

**Consistency mode costs almost nothing.** The raw SpiceDB engine is not the bottleneck —
it is, if anything, faster per-check than the legacy Postgres evaluator (0.4–0.5 ms vs.
0.9–2 ms p50 in the table above).

**So where did the 3.5 ms p50 / 23–30 ms p99 in the full run come from?** The coordinator.
Before consulting either evaluator, `resolveAuthorizationScope` resolves the actor and
tenant boundary via Postgres (`apps/web/lib/authorization/source-scope.ts`), and the
resolvers behind it (`apps/web/lib/authorization/resolvers.ts`) are wrapped in React's
`cache()` — which deduplicates *within one render*, not across independent calls. The perf
harness is a script, not a React render, so every one of its 5,000 iterations paid full,
uncached Postgres resolution cost. **This script cannot see the benefit `reactCache` gives
a real request that makes several checks against the same resource**, and its numbers are
a pessimistic bound for that reason, not a discovery that SpiceDB or its consistency
requirement is expensive.

Practical upshot: don't read `fully_consistent` as villain. The real open question is
whether `resolveAuthorizationScope`'s resolvers get real request-scoped caching in
production the way this script cannot exercise — worth a follow-up, not a finding this
report can close on its own.

## Results — request amplification (the N+1 claim)

```
apps/web/lib/authorization/checks-per-request.integration.test.ts
```

| Surveys in workspace | Authorization checks issued |
| --- | --- |
| 50 | 1 |
| 3,000 | 1 |
| **Δ (3,000 − 50)** | **0** |

One `workspace.read` decision gates the whole list; `getSurveys` runs no authorization of
its own. The check count does not grow with the row count — the property "Prove current
workspace-scoped list paths do not perform one AuthZed check per survey" from the ticket
scope, stated as a passing assertion rather than a grep result.

This is backed by a request-scoped counter
(`apps/web/lib/authorization/context.ts:recordAuthorizationCheckIssued`), incremented once
inside `can()` itself — the one point every `can()`/`assertCan()` call passes through
regardless of caller — and reported in production as
`formbricks_authorization_checks_per_request`, a histogram tagged by surface. That metric
is the thing to watch on a real dashboard for the general "no page regresses into an N+1"
question; this report only exercised the one path the ticket named by name.

**What this does not cover:** other list/export paths (dashboards, responses, API-key
scoped listing) were not individually walked with the counter. The static sweep for this
branch (zero `can()`/`assertCan()` calls found inside a loop across 19 call sites) is
still the only evidence for those, and — per the correction above — a static read is
exactly the kind of claim this project has already been burned by trusting alone. Treat
the other list paths as *likely* fine, not *proven* fine.

## Environment and caveats

- **One laptop, one run, no dedicated hardware.** Per general performance-regression
  practice, a benchmark on shared/noisy hardware without measuring its own variance first
  is a signal, not an SLO — these numbers should inform a budget discussion, not become one
  by default.
- **Local SpiceDB, no real network hop.** `formbricks-spicedb-1` runs in the same Docker
  network as Postgres on the same machine as the client. Staging/production numbers will
  differ, likely upward, once a real network path is in the loop.
- **`large` scale (500k responses, per the ticket's response-heavy analytics mention) was
  not run.** `default` (6,000 surveys, 50,000 responses) is what these numbers reflect;
  responses only affect the analytics/export paths, not the authorization graph, so this
  gap matters less than it sounds — but it is untested.
- **No concurrent-load / throughput ceiling test.** 16 concurrent checks is nowhere near
  what BI-scale traffic would look like; this measures per-check latency, not the system's
  saturation point.
- **The `reactCache` gap above is real and unresolved.** These numbers likely overstate the
  coordinator's cost under real Next.js request handling and understate it for the very
  first check in a request that makes several. Neither direction is quantified.
- **`fully_consistent` is required by env validation whenever any enforcement rule is set**
  (`apps/web/lib/env.ts`) — not a choice this report's SpiceDB numbers could have avoided.
  AuthZed's own docs note that mode "reduces cache hit rate, increasing latency and load on
  the datastore" compared to `at_least_as_fresh` with ZedTokens — worth revisiting given
  the correction above shows the effect was smaller than first assumed, but the
  recommendation itself hasn't been re-evaluated against this app's actual freshness needs.

## Reproducing this

```bash
# 1. Bring up SpiceDB locally (schema + a throwaway preshared key/db password)
docker compose -f docker-compose.dev.yml up -d --no-deps authzed-db-bootstrap
docker compose -f docker-compose.dev.yml up --no-deps spicedb-migrate
docker compose -f docker-compose.dev.yml up -d --no-deps spicedb
pnpm authzed:schema apply

# 2. Seed + project
pnpm authzed:perf seed --scale=default
pnpm authzed:backfill --apply --scope=all

# 3. Measure
pnpm authzed:perf run --iterations=5000 --concurrency=16

# 4. The N+1 proof
pnpm --dir apps/web test:integration lib/authorization/checks-per-request.integration.test.ts
```

## Follow-ups

- Walk the dashboard, response, and API-key-scoped list paths with the same counter the
  survey list got here, rather than resting on the static sweep.
- Quantify the `reactCache` gap: reproduce a fake request boundary per iteration in the
  perf harness (or run the counter test at BI scale for a fuller path) to see whether
  request-scoped caching meaningfully changes the coordinator's contribution.
- Revisit whether `at_least_as_fresh` + ZedTokens is viable for the enforcement path, now
  that the correction above shows the consistency-mode cost is smaller than first assumed.
- Run the `large` scale profile (500k responses) at least once to confirm nothing changes
  qualitatively — response volume shouldn't move the authorization graph, but that's an
  assumption this report states, not one it tested.
- Add a `formbricks_authorization_checks_per_request` alert threshold once real production
  values establish a baseline (this report has no basis for picking a number).
