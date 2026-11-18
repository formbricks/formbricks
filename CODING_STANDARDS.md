# Coding Standards

Read when planning a change and when reviewing a diff: the `code-review` skill's Standards pass applies this
file. Mechanical rules live in oxlint (`packages/config-oxlint/`, each workspace's `oxlint.config.ts`), `pnpm lint`
and CI, so check their output before repeating a finding.
This file holds only the judgement calls no check can stand in for. Where an ADR in `docs/adr/` decides
otherwise for its area, the ADR wins.

## Gates

A gate (sign-up policy, role floor, entitlement, PIN or single-use link, survey status, visibility) is one
function that every entry point to the data calls, and the PR names the entry points it checked: server
actions (callable directly, whatever the UI hides), `/api/v1`, `/api/v2`, `/api/v3`, the Better Auth
endpoints mounted raw at `/api/auth/*` ([ADR-0017](docs/adr/0017-better-auth-native-endpoints-closed.md)),
public client routes and `/storage`, MCP tools and API-key paths, and the write side of a read-gated module.
A gate on fewer paths than reach the data is a finding, and so is a second copy of the predicate.

## Writes

- A check that guards a write (a limit, a status, ownership, `finished`, "first user") runs in the same
  transaction as the write, either on a row read `FOR UPDATE` or as the write's own `WHERE`
  (`DELETE … WHERE "archivedAt" IS NOT NULL`). A check read before the transaction is a race. Snapshots for
  audit logs and "previous value" diffs are read under that lock too.
- A new or tighter input cap applies to what the caller sends, on every write path to that field (create,
  update, add, duplicate, MCP). Stored rows are read with the read schema, so a cap never makes an existing
  record unreadable or un-patchable: a name-only PATCH on a survey with 101 variables still succeeds.

## Fixes

A fix names its siblings. Search for the same call, predicate or literal, then fix every copy in the same PR
or list the ones left under Open gaps. A defect found in one place has usually been copied.

A change that replaces a tool keeps every behaviour the old setup carried (script flags, inline config
comments, per-package overrides) or lists what it drops under Open gaps.

## Testing Guidelines

Prove a behavior at the cheapest level that can fail on it. An E2E test has a different subject (the
journey, not the logic) and is paid on every PR, by everyone, forever: the Playwright job is the PR gate's
critical path.

| The change                                                                      | The level                                     |
| ------------------------------------------------------------------------------- | --------------------------------------------- |
| A new feature area, or a journey across several surfaces                        | One happy-path E2E + unit tests for its logic |
| Business logic, invariants, validation, derivation, permissions — anything pure | Unit test on the `.ts`                        |
| A route's authorization, response shape, or query scoping                       | Unit or integration test on that route        |
| A UI detail inside a feature that already has a happy-path spec                 | Neither — verify manually, say so in the PR   |

Logic inside a `.tsx` moves into a `.ts` module and is unit-tested there; components get no unit tests.
The PR's Coverage levels: `unit (red on main)` fails against the old code, proving the bug existed;
`unit (mutation)` fails only when the new code is broken; `unit (guard)` passes either way, protecting
against a future regression; `e2e` and `manual` say where the check ran.
