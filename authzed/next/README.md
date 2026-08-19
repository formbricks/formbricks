# Do we still need Workspaces?

**Short answer: yes — one container, and not the one we have today.**

These are **design artifacts for the Phase-2 authorization model**. Nothing here is wired into
runtime code, and `authzed/schema.zed` — the frozen cutover artifact — is untouched. Run
`bash authzed/next/validate.sh` to check the three candidates; `pnpm authzed:validate` still runs
the shipping parity suite independently.

| File                                           | What                                                                                                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `VOCABULARY.md`                                | What a Team is, what a Workspace is, and the test that settles "where does this go?"                                                            |
| `ENTERPRISE-REQUIREMENTS.md`                   | The sourced evidence base — XM competitors, compliance regimes, German co-determination — each requirement classified SCHEMA / POLICY / SURFACE |
| `SCENARIOS.md`                                 | The requirement corpus every candidate is tested against                                                                                        |
| `ENGINE-FACTS.md`                              | Three SpiceDB behaviours verified by execution, one of which is a trap                                                                          |
| `candidate-{a,b,c}-*.zed` + `-validation.yaml` | Three models, one corpus, same tool                                                                                                             |
| `COMPARISON.md`                                | The scorecard and the verdict                                                                                                                   |

---

## The question was two questions

**1. Do we need a resource-grouping object at all?** Yes, and this one is not close.

- Without it, "give this group this body of work" is one relationship **per survey** — roughly
  6,000 writes at BI scale, re-applied on every create. With it, one.
- The `read/write/manage` ladder is defined once and reused by every leaf type. Without a container
  it is duplicated across the ten `workspace_inherited_resource` models in
  `apps/web/lib/authorization/resource-inventory.ts`, and more as Workflows and Distributions land.
- Compliance requires it in as many words: _"a resource hierarchy where a grant can attach at any
  level… if grants only exist at org level, every other requirement is unsatisfiable"_ (ISO A.8.3,
  ORP.4.A2/A7, DORA RTS 21(a)).
- Candidate C — no container — cannot express five requirements at all, and the mutation test showed
  why that matters: revoking a grant in A and B correctly cascaded to the Brand Kit and
  Distribution; in C nothing cascaded, because the pool holds its own hand-kept list. C can imitate
  today's answer. It cannot express the rule.
- `Personal workspace per user` is already a locked requirement anchor on the board — and a personal
  space _is_ a container. The private-survey requirement adds a flavour of the concept rather than
  removing it.

**2. Must that object be separate from the people-group?** Yes — for Formbricks specifically.

Linear does not refute the container. **Linear merged the container into the group and then nested
it five levels deep.** Sentry converged on the same shape. Both can, because both are _open by
default_: anyone may view and join any non-private team. Formbricks sells to banks, government and
works-council industrials, where **closed by default** is the requirement, and under
closed-by-default "group A reads group B's work at read tier" stops being an exception.

Candidate B models that faithfully, and the suite shows the cost as a fact rather than an opinion:
`team:cx#read@user:tina` is **true** while `team:cx#member@user:tina` is **false**. Tina can read,
write and manage that body of work and is not a member of it. One object, two meanings — issue
**I-12 (teams are overloaded)** promoted from accident to structure. `zed` itself objects four
times: _"Relation `writer_team` references parent type `team` in its name."_

So: **`team` answers WHO, the container answers WHAT**, joined many-to-many with a tier — the shape
Formbricks already has. That part was right.

---

## What has to change

The workspace is not wrong because it exists. It is wrong because it does four jobs at once.

1. **Strip it to a container + grant scope.** `styling`/`logo` → **Brand Kit**; `config`,
   `placement`, `overlay`, `recontactDays`, branding flags, `customHeadScripts` → **Distribution**;
   `Contact*` → **Contact Directory**; datasets already org-level. Each becomes a pool reached by an
   explicit assignment. _This is what removes the "grant a workspace ⇒ silently grant the org's most
   sensitive dataset" leak (I-3) that started this whole line of thinking._ A stripped container is
   cheap, and cheap is what makes it defensible.
2. **Give it an owner that is one-of `{organization, team, user}`** — shared programme, team space,
   personal space. One object, three flavours. Kills the "team of one" hack.
3. **Add direct, additive grants on leaves** (survey first, per the board's locked v1 scope), with
   `user` as a first-class grantee.
4. **Let it nest.** Divisions are a `parent` edge. Verified working three levels deep, flowing down
   only.
5. **Keep responses out of SpiceDB.** 3–4M rows stay parent-derived, as `resolvers.ts` already does.
6. **Dependencies never flow.** There is deliberately _no arrow_ from `survey` to contacts, datasets,
   brand kits or distributions. Sharing a survey hands over the survey and nothing it depends on.

And one thing that is **not** the workspace, which matters more than it looks: **the org-unit
hierarchy for employee experience.** A works agreement says a manager sees their own organisational
unit and below. That is a different tree — respondents not builders, fed from the HRIS, versioned at
survey close. Squashing it into the workspace is precisely how Qualtrics ended up with Brand +
Division + Group + User Type + Org Hierarchy. `candidate-a-container.zed` models both, and they
never touch.

---

## The three recommendations you asked for

**Nesting — design it in now, expose one level in the UI.** Divisions are a real enterprise
requirement (Qualtrics ships them, Linear needed five levels, BI has them). Carrying an unused
`parent` relation costs one nullable column and three `+ parent->…` terms. Adding it later means
re-deriving every permission and re-backfilling the graph. Cap the depth explicitly and forbid
cycles, per AuthZed's warning.

**Private surveys — Figma's model, plus a switch for regulated customers.**

- Personal content lives in a **personal container owned by a user**, not a nullable parent on the
  survey. No special case, no unlistable content — Miro's users complain about exactly that.
- Org owners/managers can **see it exists and transfer or delete it, but not read it**. `administer`
  is a permission distinct from `read`, which is what makes the word "private" honest. Verified: an
  org owner is denied `read` on a personal container while holding `administer`.
- A **time-boxed, auditable break-glass grant** turns admin read on for one person for one purpose —
  never "temporarily make them an admin", which is what DORA RTS 21(e)(ii) exists to forbid.
- **Offboarding: quarantine, never silent inheritance and never silent deletion.** The container is
  frozen and an admin reparents it or deletes it. This also implements the Notion doc's "active
  owner" idea — grants a leaver issued die with their standing rather than outliving them.
- `createdBy` stays immutable attribution; control is the transferable `owner` relation. That is the
  board's rule 7, and it is what Qualtrics and SurveyMonkey got wrong — both had to build transfer
  tooling, and both tools leak. Alchemer, which put ownership on the container, needs none.

**The narrow-vs-over-engineered risk.** The asymmetry favours designing the _shape_ now: relations
and edge types are cheap to carry and ruinous to retrofit — recursion, owner-one-of, per-leaf grants
and verb splits all re-derive the whole graph. Surfaces — UI, share links, divisions in navigation,
recertification campaigns — are cheap to add later. The rule throughout: **be generous with
structure, stingy with surface.** And for self-hosted enterprises the obligation is not to _be_
compliant but to be **auditable and configurable** — they hold the certificate and run the campaign;
we owe them enumerable permissions, an exportable role matrix, and the ability to represent _their_
role model rather than imposing ours.

---

## What would change the answer

Stated so it is falsifiable rather than preferred:

- Real `WorkspaceTeam` data showing workspaces almost always have exactly one team and teams almost
  always one workspace → the pair has no independent life and **candidate B wins**.
- A decision to make Formbricks open-by-default inside an organization → **B wins**.
- Confirmation that no customer will need divisions, cross-group tiers, or pools shared across
  bodies of work → **C becomes defensible**.

The first is measurable, just not on Cloud, where the enterprises are absent because they
self-host. Any self-hosted design partner can answer it with three counts: workspaces with >1 team,
teams with >1 workspace, distinct tiers per pair. That is the single highest-value piece of evidence
still missing, and it is cheap to get.

---

## Still open

- Does a survey ever need more than one home container? Linear made projects many-to-many for
  exactly this.
- Grants are additive, so there is no way to exclude one person from one survey inside a container
  they can read. Acceptable, or is a deny-edge needed? Exclusions are the hairiest corner of the
  language and break `LookupResources` ergonomics.
- Is `summary` a SpiceDB permission or an application projection over `read`?
- Are API keys user-bound PATs, org-owned service accounts, or both? Today a leaver's key keeps
  working (I-6).
- Do share links become principals (R5), or stay capability tokens?
- Custom roles here are bundles of _people_ bound at standard tiers. Roles defining genuinely new
  capability sets need generated schema — no sourced requirement asks for that yet.
