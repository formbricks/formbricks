# Scorecard: three candidate models against one scenario corpus

All three schemas were run against the same scenarios with the same tool
(`bash authzed/next/validate.sh`, `zed validate`, pinned `authzed/zed:v1.1.1`, offline).

```
=== candidate-a-validation.yaml ===  Success! - 96 relationships, 91 assertions, 4 expected relations
=== candidate-b-validation.yaml ===  complete - 71 relationships, 57 assertions, 2 expected relations
=== candidate-c-validation.yaml ===  Success! - 62 relationships, 45 assertions, 2 expected relations
```

Every suite was mutation-tested: deleting one fixture relationship turns each suite red, so the
green results are load-bearing rather than vacuous.

| Dimension                        | **A — stripped container**                                           | **B — Linear shape (team is the container)**                                                                                                       | **C — no container**                                                                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distinct scenarios expressed     | **66**                                                               | 42                                                                                                                                                 | 36                                                                                                                                                                                                |
| `MUST` scenarios inexpressible   | **0**                                                                | 0 (but see overload)                                                                                                                               | **5**                                                                                                                                                                                             |
| "Give group G this body of work" | **1 tuple**                                                          | 1 tuple                                                                                                                                            | **1 tuple per survey** (~6,000 at BI scale), re-applied on every create                                                                                                                           |
| "Create one survey"              | **1 tuple** (`survey#container`)                                     | 3 tuples (`organization`, `org_reach`, `team`)                                                                                                     | ~5 tuples (tenancy + break-glass + one per group that should see it)                                                                                                                              |
| Modelled tuples at BI shape¹     | **~126k**                                                            | ~138k                                                                                                                                              | ~150k+ and growing with every grant change                                                                                                                                                        |
| Tenancy edges                    | 1 per container (~30)                                                | 1 per resource (~6,000)                                                                                                                            | 1 per resource (~6,000)                                                                                                                                                                           |
| List authorization               | SQL pre-filter by container, then `CheckBulkPermissions` on the page | same                                                                                                                                               | no pre-filter; `LookupResources` over every survey in the org, against AuthZed's own "gets slow past ~10k results" guidance                                                                       |
| Longest `survey.read` chain      | survey → container → (org \| team \| user), +1 per nesting level     | survey → team → parent…                                                                                                                            | survey → organization                                                                                                                                                                             |
| Revocation blast radius          | **1 tuple**; pools and leaves follow automatically                   | 1 tuple                                                                                                                                            | 1 tuple **per resource**, and pool grants do not follow at all                                                                                                                                    |
| Drift under revocation           | none — derived                                                       | none — derived                                                                                                                                     | **silent**: the mutation test removed a container grant in A and B and correctly cascaded to the Brand Kit and Distribution; in C nothing cascaded, because the pool holds its own hand-kept list |
| Nesting / divisions              | native (`parent`)                                                    | native (`parent` on team)                                                                                                                          | **not expressible**                                                                                                                                                                               |
| Overload risk (I-12)             | none — `team` = who, `container` = what                              | **structural**: `read` and `member` are two different questions about the same object; `zed` emits four `relation-name-references-parent` warnings | none (teams own nothing)                                                                                                                                                                          |
| Offboarding                      | reparent one personal container                                      | transfer N surveys individually                                                                                                                    | transfer N surveys individually                                                                                                                                                                   |

¹ Arithmetic from the fixture shape extrapolated to ~60k users, ~6k surveys, ~50 teams, ~30
containers — a modelled figure, not a measurement. The ratios matter, the absolute numbers do not.

## What actually separated them

**C loses on expressiveness, and loses hard.** Five requirements cannot be stated at all, and they
are not exotic ones: granting a group a body of work; a division-level grant reaching what is
beneath it; the guarantee that a sub-unit grant does _not_ leak upward; "a dataset assigned to two
bodies of work is visible to the union of their viewers"; and container-level tiering. The dataset
case is the instructive one — C's suite passes that assertion, but only because the fixture lists
the second team on the dataset _by hand_. Nothing keeps that list in step. The mutation test made
this visible: revoking one container grant in A and B correctly removed the Brand Kit and
Distribution access that derived from it; in C the equivalent revocation changed nothing, because
the pool's grant was independent. **C can imitate today's answer; it cannot express the rule.**

**B is genuinely viable, and that surprised me.** It expresses every `MUST` scenario, it nests, and
its offboarding story is no worse than A's. It fails on one thing, and the tool said it out loud:
the same `team` object now carries membership _and_ cross-group grants. The suite proves it —
`team:cx#read@user:tina` is **true** while `team:cx#member@user:tina` is **false**. Tina can read,
write and manage that body of work and is not a member of it. Only naming convention keeps a grant
relation apart from a membership relation, and `zed` flags all four grant relations as badly named
because the container and the group are the same type. That is issue I-12 promoted from an
accident to a structural property. B also pays three tuples per survey instead of one, because
with no container left there is nothing to carry tenancy.

**A wins on the thing that matters: the pair `(group, body of work, level)` has an object to live
on.** Everything else follows from that — one grant fans out, one revocation retracts, pools derive
their reach instead of duplicating it, and divisions are a `parent` edge rather than an enumeration.

## The honest caveats

- **A's advantage is conditional on closed-by-default.** If Formbricks were open-by-default like
  Linear and Sentry, the cross-group grant would be rare, B's overload would almost never surface,
  and B would be the better answer — one object instead of two. The bet is on the enterprise
  posture, and that is the number to revisit if it ever changes.
- **The list-authorization argument is weaker than it first looks.** AuthZed's published guidance
  is to prefer `CheckBulkPermissions` over `LookupResources` — fetch a Postgres page, bulk-check it
  at a pinned revision — and that works with or without a container. The container's real
  contribution is the cheap SQL pre-filter and stable cursor pagination, not feasibility.
- **Nothing here measures runtime.** Depth is not the cost: engine p99 is under 2 ms and
  `fully_consistent` is nearly free (`authzed/PERFORMANCE.md:101`). The costs that separate these
  candidates are write amplification, revocation blast radius and drift — all of which are
  properties of tuple _shape_, which is exactly what this comparison measures.
- **The EX / org-unit dimension is candidate-independent.** It is modelled only in A to avoid
  triplicating it, but it would be identical in B and C and does not favour any of them.

## What would change the answer

- Real `WorkspaceTeam` data showing that workspaces almost always have exactly one team, and teams
  almost always one workspace, at real tiers → the pair has no independent life, and **B wins**.
- A decision to make Formbricks open-by-default inside an organization → **B wins**.
- Confirmation that no customer will ever need divisions, cross-group tiers, or org-level pools
  shared across bodies of work → **C becomes defensible**.

The first of those is measurable. It cannot be measured on Formbricks Cloud, where the
enterprises are absent because they self-host — but it can be asked of any self-hosted design
partner as three counts: workspaces with more than one team, teams with more than one workspace,
and distinct permission tiers per pair.
