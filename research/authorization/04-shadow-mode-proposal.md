# Proposal: Shadow-Mode SpiceDB as our internal validation harness

> **Objective / audience.** A proposal from product to the eng team: run SpiceDB in *shadow mode* so we can prove the new authorization engine matches today's behavior against real traffic, rather than by hand. This builds out the shadow-mode step already sketched in the Migration Plan (Phase 1) and the day-0 parity mapping shipped with the runnable `./spicedb-schema-draft.zed`. It is a proposal, not a spec — the mechanics below are the shape we're asking eng to adopt, not the final design.

## The problem

We are replacing a home-grown authorization system that is spread across seven distinct enforcement stacks with no central logic (see Status Quo, "Where authorization is enforced today"). The sprawl is real and measured: ~40 distinct authorization helper functions, five permission vocabularies that don't compose, and "is owner or manager" independently re-implemented in at least five server-side code paths. The flagship symptom is that the single question "may user U access workspace W?" already has **three different answers in code** today.

No single person holds all the cases. Validating that a SpiceDB rewrite reproduces current behavior by hand — enumerating roles × endpoints × edge cases, testing and re-testing each combination — is error-prone and does not scale. The cases that bite us are exactly the ones no one thinks to enumerate.

## The proposal

Run SpiceDB in **shadow mode**. Once the `can(actor, action, resource)` choke point exists (Migration Plan, Phase 0), every authorization decision evaluates **both** engines:

- **Legacy logic is authoritative** — its answer is the one returned and enforced.
- **SpiceDB runs in shadow** — its answer is computed against the backfilled tuples (the day-0 parity mapping at the bottom of `./spicedb-schema-draft.zed`) and only logged.

When the two disagree, emit a structured diff:

```
{ actor, action, resource, legacyResult, spiceResult }
```

Nothing about the user-facing result changes. Legacy decides; SpiceDB is observed.

## Why this is the right harness

It converts "does SpiceDB match today?" from a human enumeration problem into a **data problem answered by real staging and production traffic**. We don't have to imagine the edge cases — the traffic exercises them for us.

- **Diffs point exactly at what we modeled wrong** — the long tail of role/endpoint/edge-case combinations no one would think to test surfaces itself as a divergence, with the actor/action/resource attached.
- **Confidence to cut over becomes measurable, not a leap of faith** — readiness is a diff rate trending to zero over the surfaces that matter, not a signed-off checklist.
- **Zero user-facing risk** — legacy stays authoritative right up until we deliberately flip, so a modeling bug in the SpiceDB schema can never deny or grant access to a real user during validation.

## What we are NOT proposing

We are explicitly **not** shipping a dual or toggleable authorization system to customers or self-hosters. Maintaining two authorization semantics forever is precisely the disease this whole project exists to cure — it is why SpiceDB is a hard dependency with no Prisma fallback engine (see Product Lens, decision D1).

Shadow mode is an **internal development and validation harness only**: it runs on *our* environments, its second answer is never enforced, and it is removed after cutover. It is scaffolding for the migration, not a product feature.

## Cost / effort

Small, once the `can()` choke point exists. It is:

1. one instrumentation point inside `can()` (call the shadow engine, compare, never enforce),
2. structured diff logging, and
3. a simple diff dashboard / alert on divergence rate.

It piggybacks on the decision-log emission already planned for Phase 0 and the dual-write / backfill work already in the Migration Plan (Phase 1) — this proposal is the *comparison and gate* layered on top, not new infrastructure.

## The ask

Adopt shadow-mode diffing as the **validation gate between Phase 1 and cutover**: enforcement flips per surface only after that surface's diff rate reaches ~zero. As part of accepting this, define the surfaces that must clear the bar before we flip — the server-action, v1/v2/v3 API, page/layout, and client-API enforcement stacks — and the acceptable residual-diff threshold (ideally zero) for each.
