# Survey visibility — v3 API contract (proposal)

Status: **draft for agreement** · ticket ENG-3281 · milestone "API Contract" (Authorization – Phase 2)

This directory holds the API contract for private and workspace-visible surveys, agreed between backend
and frontend before either is built. It is deliberately **outside** `docs/api-v3-reference/src/`:
every operation documented there is driven against a live instance by the Schemathesis job on each
PR, and `problem-codes.test.ts` requires `Problem.yml` to list exactly the codes the code emits. A
contract for endpoints that do not exist yet cannot live there without failing both. It moves into
`src/` in the same PR that ships the handlers (see "How this lands").

- [`openapi.yml`](./openapi.yml) — self-contained OpenAPI 3.1 **delta**: only the changed and added
  operations and schemas. Lints on its own with
  `pnpm exec redocly lint docs/api-v3-reference/proposals/survey-visibility/openapi.yml`.
- [`build-mock.mjs`](./build-mock.mjs) — overlays the delta onto the committed bundle
  `docs/api-v3-reference/openapi.yml` and writes `.generated/openapi.mock.yml` (gitignored): the
  complete contract, every existing parameter and schema included. That file is what ENG-3200 mocks:
  `node docs/api-v3-reference/proposals/survey-visibility/build-mock.mjs && npx @stoplight/prism-cli mock docs/api-v3-reference/proposals/survey-visibility/.generated/openapi.mock.yml`.
  Lint it with `pnpm exec redocly lint --config docs/api-v3-reference/redocly.yaml --skip-rule no-ambiguous-paths docs/api-v3-reference/proposals/survey-visibility/.generated/openapi.mock.yml`
  (the skipped rule is the bundle's six known workflow-path findings, whose ignore file is keyed to `src/`).
- This file — the rules the YAML cannot express: who may do what, gating, list semantics, responses,
  lifecycle, and the decisions behind them.

Sources of truth, in precedence order: [Key Decisions](https://app.notion.com/p/3d0e5de84a588192b126d730c97830af)
(16, rev. 14 Sep) → [User Stories v2](https://app.notion.com/p/3d0e5de84a5881bcac42c7570611e99f) →
[SpiceDB migration RFC](https://app.notion.com/p/3dee5de84a58813ca990da360aef859e) (17 Sep) → ENG-3202
(leak inventory), ENG-3203 (projection), ENG-3204 (healing). Where they disagreed, the calls are logged
in the ENG-3281 comment thread and repeated in §9.

## 1. What changes, in one paragraph

Every survey carries a `visibility` of `private` or `workspace`. Workspace-visible is today's behaviour.
A private survey is readable only by its **owner** (the author, projected as `survey#owner@user`) and by
the organisation's owners and managers; nobody else can see that it exists, API keys included. New
surveys created by a signed-in person start private; surveys created with an API key start
workspace-visible. Visibility is changed through one dedicated endpoint, never through `PATCH`.
Responses follow their survey. While a change is in flight the survey is private to everyone but its
owner and the organisation's owners and managers, whichever direction is queued. Nothing about
respondents or public collection changes.

## 2. Resource changes

Three fields are added to `SurveyListItem` and `SurveyResource`. All three are **required and always
present**, so clients never branch on absence.

| Field        | Type                           | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `visibility` | `"private" \| "workspace"`     | The **effective** visibility: what the backend enforces on this request. See §5 for when it differs from the stored flag.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `owner`      | `{ name } \| null`             | The authorization owner (Decision 16). Display only, like `creator`: no user id — `access.via === "owner"` answers "is it mine" and `filter[owner][in]=me` filters server-side; an identifier can be added later, additively. `null` when the author's account is gone or the survey was created with an API key. Distinct from `creator`, which stays pure attribution and is never rewritten; in Scope 1 the two coincide whenever both are non-null. **Durable source is `Survey.ownerId` in PostgreSQL**, set null on user deletion and projected to `survey#owner@user`; the graph never holds ownership alone, so a rebuild from an empty graph restores it (ENG-3203, ENG-3204).          |
| `access`     | `{ via, canManageVisibility }` | Server-derived, per caller. `via` says why this caller can see the survey: `"workspace"` (workspace-visible and the caller has workspace read), `"owner"` (private, caller is the owner), `"organizationRole"` (private, caller reaches it only as organisation owner/manager). **Open string, not a closed enum**: named sharing will add values, so clients treat unknown strings as "another access path" and never branch exhaustively. Explanatory metadata, never authorization truth. `canManageVisibility` is permission only — `survey.change_visibility` — and shows or hides the controls; it can be `true` while `allowedTargets` is empty. The backend re-checks on every mutation. |

`via` is chosen lowest-privilege-first: an organisation manager who is also a member of the workspace
sees `"workspace"` on a workspace-visible survey and `"organizationRole"` on a colleague's private one.
The admin banner ("This survey is private to {Name}. You can see it because you're an organisation
owner or manager") renders exactly when `visibility === "private" && access.via === "organizationRole"`.

API keys always receive `visibility: "workspace"`, `access.via: "workspace"`,
`access.canManageVisibility: false` (K-4).

`visibility` is **not** accepted on `POST /api/v3/surveys` or `PATCH /api/v3/surveys/{surveyId}`. Both
answer **400** with `invalid_params[].code: unsupported_field`, the same way `createdBy` and `type`
are refused today. Creation visibility is decided by the principal (§4); changes go through §3. This
is the smallest surface that satisfies R-11 ("one rule, no exceptions") and K-4, and it is additive to
relax later if a use case appears.

## 3. New operations

### `GET /api/v3/surveys/{surveyId}/visibility`

Read-only preview for the Collaborate panel, the row menu and the two confirmation dialogues. Returns
the current state plus what a change would do:

- `blockers[]` — outbound connections that make `private` refusable right now: `webhook`,
  `integration`, `feedbackSource`, `dashboard`, `workflow` (Decision 13 plus ENG-3202 decision 3).
  Each carries `type`, `id`, `name`. Empty when going private is allowed. Always empty for the
  `workspace` direction.
- `impact` — `memberCount`: people other than the owner and the organisation's owners/managers who
  can see the survey today (workspace-visible) or would gain access (private). `responseCount`: the
  survey's responses. Feeds "Hide this from your team? {N} people lose access to this survey and its
  {M} responses."
- `allowedTargets[]` — the values a `POST` by this caller would act on right now. Never the enforced
  value, **except** when a different value is pending: then the enforced value is listed because
  requesting it cancels the pending change. Never `private` while `blockers[]` is non-empty or `owner`
  is `null`. The row menu and the editor control render from this, so a user is never offered a
  transition that answers 409 or 422, and always sees the cancel action while something is pending.
- `pending` — the value a `POST` stored that the graph has not yet acknowledged; `null` normally.
  While non-null the survey is private to everyone but owner and admins, whichever value is pending.
- `version` — monotonic per survey, incremented by every accepted `POST`. Fences projection work.

Authorization: `survey.change_visibility`, the same permission as the `POST`. Read and write members,
team-level managers and every API key answer 403 with the same body as an unknown id (Decision log
#7). Connection ids and names are configuration that only the people who may act on them need.

### `POST /api/v3/surveys/{surveyId}/visibility`

Body `{ "visibility": "private" | "workspace" }`. Two directions, two guarantees (Decision log #10):

- **Restrictions take effect at once.** `workspace → private` stores the flag, a new `version` and a
  pending marker in one transaction. From that instant the survey is private on every path — single
  reads, lists and counts, responses, exports — for everyone but the owner and the organisation's
  owners and managers, whether or not the graph has caught up. This is the durable pending marker
  ENG-3204 asked for: it denies immediately, without waiting for the deployment-wide 60-second guard.
  The relationships are then projected; the answer is **200** either way, `pending: null` if the graph
  acknowledged this version in-request, `pending: "private"` if the outbox will finish it.
- **Grants take effect when enforced.** `private → workspace` answers **200** only once the graph has
  acknowledged this exact `version`; until then the survey stays private. If the in-request projection
  fails, **503** `projection_pending`: stored, queued, `GET` shows `pending: "workspace"`, retry is safe.

**Fencing** (Decision log #11). Every accepted `POST` increments `version`. Projection work carries the
version it was issued for; a projector holding an older version never writes, so a worker leased
before a newer change — or one that crashed before its verification pass — cannot overtake it. A 200
for a grant means the graph holds this exact version, not merely that a re-read of the flag agreed.

**No-ops and cancellation.** Requesting the value the survey already enforces, with nothing pending, is
a **200 no-op**: nothing written, nothing audited, `changedAt` / `changedBy` describe the last real
change — both `null` when there never was one. Requesting the enforced value while the _opposite_ is
pending **cancels** the pending change: new version, queued work superseded, 200 with `pending: null`.
Requesting the pending value again re-attempts the projection (200 or 503). No answer can be
overtaken by earlier work.

Precedence when `private` is refused for two reasons at once: **422 before 409**. A survey with
`owner: null` that also has outbound connections answers 422; the missing owner cannot be fixed, so
listing connections to remove would send the caller down a dead end. `allowedTargets` already omits
`private` in both cases.

| Result                                  | When                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 200                                     | Changed and enforced; or a restriction stored and enforced with the graph still catching up (`pending: "private"`); or a no-op; or a cancellation.                                                                                                                                                                                                                           |
| 400 `bad_request`                       | Malformed body, unknown value, stray query parameter.                                                                                                                                                                                                                                                                                                                        |
| 401 `not_authenticated`                 | No credentials.                                                                                                                                                                                                                                                                                                                                                              |
| 403 `forbidden`                         | Caller cannot see the survey (unknown id, other workspace, private and not owner/admin), **or** caller is an API key (K-4), **or** caller sees it but may not change it (workspace member, team-level manager — R-10). One body for all, so nothing is probeable.                                                                                                            |
| 403 `visibility_not_enabled`            | The RBAC entitlement is missing on the organisation, or the deployment's readiness marker is not set (§5). Independent of the survey, so not an existence leak.                                                                                                                                                                                                              |
| 409 `visibility_blocked_by_connections` | Requested `private` while `blockers[]` is non-empty. `details.blockers` repeats the list so the UI can name them without a second call.                                                                                                                                                                                                                                      |
| 422 `visibility_change_not_allowed`     | Requested `private` on a survey with `owner: null` (Decision log #3). `detail` says to duplicate the survey for a private copy.                                                                                                                                                                                                                                              |
| 429 `too_many_requests`                 | Per-actor limit on visibility changes (RFC §2b: a loop of `workspace → private` must not be able to arm the freshness guard). Value set by backend; `Retry-After` present.                                                                                                                                                                                                   |
| 503 `projection_pending`                | **Grants only.** The flag and version were stored but the graph did not acknowledge in-request. The survey stays private meanwhile; the change lands within 60 s or fails closed. `GET …/visibility` shows `pending: "workspace"`. Retrying is safe; `POST private` cancels. Chosen over 202 so pending stays an exception, not a path every client polls (Decision log #8). |

Authorization: a new action `survey.change_visibility` = owner (who still holds workspace read) **or**
organisation owner/manager. Not workspace write, not team-level manage. In the RFC's schema this is
`(owner & workspace->read) + workspace->administer`.

Audit: every successful change is recorded with actor, survey, old and new value (Decision 7, 11).
Proposed action name `visibilityChanged` on target `survey`.

### Outbound plumbing, both directions (Decision 13, R-6)

The invariant is "a private survey never feeds outbound plumbing", and it has to hold whatever the
order of operations. Three enforcement points, all required:

1. **Flip time** — `workspace → private` answers 409 while a webhook, integration, feedback source,
   dashboard/chart or workflow references the survey (`blockers[]`, above).
2. **Attach time** — every surface that attaches a survey to outbound plumbing refuses a survey that is
   private **or has a change pending**, with **422** `survey_not_workspace_visible` and an
   `invalid_params` entry naming the field. In v3 today that is `POST` and `PATCH /api/v3/workflows`
   (`definition.trigger.config.surveyId`); the same code applies to the v1/v2 webhook endpoints
   (`surveyIds[]`), and to the in-app integration, feedback-source and dashboard flows. Survey pickers
   in those flows omit private surveys altogether, with the outbound-block copy where the picker is.
3. **Dispatch time** — the pipeline skips a private survey even when a connection somehow references
   it: wildcard webhooks (`surveyIds: []` means every survey in the workspace) cannot be blocked at
   attach time, and a race between a flip and an attach can slip through both checks. Skipped
   deliveries are logged with the survey and connection ids (ENG-3202 decision 1).

Feedback records already copied into a dataset stay where they are; the flip is blocked by the
connection (point 1), which is the project's answer for webhooks and integrations too.

### Publishing and scheduling (V-3)

Publishing is still `PATCH … { "status": "inProgress" }` (or setting `publishOn`). It **never**
changes visibility. The publish dialogue's "Everyone in {Workspace}" answer is a client-side chain:
`POST …/visibility { "workspace" }` first, then the status `PATCH`. The order matters: the first call
is a pure grant, so a failure in the second leaves a harmless state. A scheduled survey publishes with
whatever visibility it has at fire time; the question was asked when the schedule was set.

## 4. Creation defaults

| Principal                                         | Entitlement + marker on       | Otherwise   |
| ------------------------------------------------- | ----------------------------- | ----------- |
| Signed-in user (session, MCP OAuth)               | `private`, `owner` = the user | `workspace` |
| API key (`x-api-key`, Bearer, MCP API-key bearer) | `workspace`, `owner: null`    | `workspace` |

Applies to every creation path, not only `POST /api/v3/surveys`: blank, template, generate-then-create,
duplicate, copy to another workspace (R-11). Duplicate and copy set `owner` to the acting user, not the
original owner.

## 5. Gating: entitlement and readiness marker

Two switches gate the feature (Decision 6; RFC §2b "readiness marker"). The contract makes their
combination observable without a separate capability endpoint:

| RBAC entitlement | Readiness marker | `visibility` reports           | Enforcement                                                             | `access.canManageVisibility` | `POST …/visibility`          | Session create default |
| ---------------- | ---------------- | ------------------------------ | ----------------------------------------------------------------------- | ---------------------------- | ---------------------------- | ---------------------- |
| on               | on               | stored flag                    | private surveys hidden                                                  | per §3 rules                 | enabled                      | `private`              |
| off              | on               | stored flag                    | private surveys **stay hidden** (Decision 6: "nothing is released")     | `false` for everyone         | 403 `visibility_not_enabled` | `workspace`            |
| any              | off              | `"workspace"` for every survey | none — evaluator collapses to workspace permissions (Phase 1 behaviour) | `false`                      | 403 `visibility_not_enabled` | `workspace`            |

Row two is the downgrade case: private surveys are frozen private until the organisation is entitled
again. Row three is rollback: the stored flag is preserved (R-12) but reported as `workspace` because
that is what is enforced; reporting `private` for a survey every colleague can open would be a false
promise. The RFC's rule stands: the entitlement alone must never enable a control the evaluator is not
enforcing.

## 6. List behaviour (`GET /api/v3/surveys`)

- The list returns **only surveys the caller may read**. `meta.totalCount` and
  `meta.workspaceSurveyCount` count that same set — a private survey must not be countable by someone
  who cannot see it (ENG-3202 §5 "existence oracles"). Day one nothing is private, so both numbers are
  unchanged for every existing caller; they narrow only once a person makes a survey private.
- Filtering happens in the SQL predicate and the keyset cursor, never as a post-filter (ENG-3202 §5).
  The RFC's candidate-page + `CheckBulkPermissions` design keeps filling the page, so `limit` semantics
  are unchanged and `meta.nextCursor === null` remains the only end-of-collection signal.
- New filters, same shape as `filter[status][in]`:
  - `filter[visibility][in]` — `private`, `workspace`. Values outside the enum → 400.
  - `filter[owner][in]` — `me`, `others`. Relative to the caller; an API key sending it gets 400.
- `meta.visibilityCounts: { private, workspace } | null` — counts for the Visibility filter badges,
  over the caller-readable set and respecting every filter **except** `filter[visibility]`. `null`
  when `includeTotalCount=false`, the same gate as the other counts. _Frontend to confirm the badges
  are wanted before backend implements this; drop it otherwise._
- Archived surveys keep their visibility (R-9): `filter[status][in]=archived` on a private archived
  survey lists it to its owner and organisation admins only.

## 7. Responses follow the survey (R-8)

No schema change on `/api/v3/responses/**`; behaviour only. Every response operation resolves the
response to its survey and authorises against `survey.response_read` / `survey.write` /
`survey.manage` instead of the bare workspace ladder. A survey with a pending visibility change counts
as private here too (fail closed):

| Operation                                                      | Private survey, caller cannot see it                                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /responses?workspaceId=…` (no `surveyId`)                 | Its responses are absent; `meta.totalCount` excludes them.                                                                                  |
| `GET /responses?surveyId=S`, `GET /responses/count?surveyId=S` | 403, identical to an unknown survey id.                                                                                                     |
| `GET /responses/{id}`, `PATCH`, `DELETE`                       | 403, identical to an unknown response id.                                                                                                   |
| `POST /responses` with `surveyId: S`                           | 403. (Public collection through the SDK and link is unaffected — different endpoints, Decision 5.)                                          |
| `POST /responses/batch-delete`                                 | Ids of such responses are scope-filtered out and simply not counted in `deleted`, consistent with the operation's existing foreign-id rule. |
| `POST /responses/validate`                                     | 403 when the anchoring survey is not readable.                                                                                              |

API keys hit every row above for every private survey. Exports (CSV/XLSX, in-app) and response alerts
follow the same permission (R-8); they are outside v3 but inside this contract.

## 8. Permission matrix

Survey **S** in workspace **W**. "ladder" = the caller's existing workspace permission level.

| Caller                                                              | S is `workspace`                | S is `private`                                                 | `POST S/visibility`      |
| ------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------- | ------------------------ |
| Owner, member of W via a team                                       | ladder                          | ladder, `via: owner`                                           | allowed                  |
| Owner, no longer in any team of W                                   | 403                             | 403 (Decision log #3, from Decision 2)                         | 403                      |
| Organisation owner / manager                                        | full, `via: workspace`          | full, `via: organizationRole`                                  | allowed                  |
| Member with team-level `manage` on W (not owner)                    | ladder                          | 403 (R-10)                                                     | 403                      |
| Member with `read` / `readWrite` on W                               | ladder                          | 403                                                            | 403                      |
| Billing role                                                        | 403                             | 403                                                            | 403                      |
| API key, any level on W                                             | ladder, `visibility: workspace` | 403 (K-1)                                                      | 403 (K-4)                |
| Anyone, S has `owner: null`, requesting `private`                   | —                               | —                                                              | 422                      |
| Organisation owner / manager, S private with `owner: null`          | —                               | full, `via: organizationRole`, `allowedTargets: ["workspace"]` | allowed (to `workspace`) |
| Read/write member, team-level manager, API key — `GET S/visibility` | 403                             | 403                                                            | —                        |
| Anyone, S has a change pending in either direction                  | treated as `private` everywhere | treated as `private` everywhere                                | per rows above           |

Lifecycle: archive and restore keep the flag (Decision 14); delete follows `survey.delete` as today;
duplicate and copy produce a private survey owned by the actor (R-11); `createdBy` is never rewritten.

## 9. Decision log (from the ENG-3281 thread, 21 Sep)

1. **403 everywhere, unchanged.** Decision 10 / K-1 say 404; v3 answers 403 for unknown, foreign and
   forbidden ids alike, and 404 only for private surveys would make the two distinguishable. Product
   text to be amended to name no code. _Owner: Johannes._
2. **Synchronous change** — superseded by #10 and #11: restrictions enforce at once through a durable
   pending marker, grants answer 200 only on an acknowledged version, 503 is for grants only.
3. **Two rules not yet on the Key Decisions page.** Author who leaves the workspace loses private
   drafts there; `owner: null` surveys cannot be made private. _Owner: Johannes to record._
4. **Workflows are outbound.** Blocked like webhooks.
5. **API keys never see private surveys.** Decision 10 as revised 14 Sep; UI Design state 9 is stale.
6. **Dedicated endpoint, not PATCH.**
7. **`GET …/visibility` requires `survey.change_visibility`** (Bhagya, PR review 23 Sep). Blocker ids
   and names are configuration; readers and API keys have no use for them.
8. **503 + `pending`, not 202** (Bhagya, PR review 23 Sep). `GET` exposes `pending` so the UI can show
   the in-between state honestly; 503 stays the exception rather than a path every client polls.
9. **`canManageVisibility` is permission-only; `allowedTargets` is target-specific** (Bhagya, PR review
   23 Sep). Keeps the administrator's recovery action on ownerless private surveys visible.
10. **Fail closed while pending** (Bhagya, second review 23 Sep; ENG-3204). A stored restriction denies
    immediately on every path; a stored grant is not in effect until acknowledged. While anything is
    pending the survey is private to all but owner and admins.
11. **Version fencing** (Bhagya, second review 23 Sep; ENG-3204). Monotonic `version` per survey;
    projectors never write an older version; a grant's 200 acknowledges the exact version.
12. **Outbound rule in both directions** (Bhagya, second review 23 Sep). Attach-time refusal with
    `survey_not_workspace_visible`, pickers omit private surveys, dispatch-time skip as the last line.
13. **Cancellation is representable** (Bhagya, second review 23 Sep). `allowedTargets` lists the
    enforced value while the opposite is pending; requesting it cancels.
14. **Contract hardening** (Bhagya, PR comment 23 Sep). `canChangeVisibility` renamed
    `canManageVisibility`; `access.via` is an open string; `owner` exposes no user id; `Survey.ownerId`
    is the durable ownership source projected into the graph.

Not yet decided, needed before backend freeze: the per-actor rate limit value; the per-workspace survey
cap default and its error (`workspace_survey_limit_reached`, RFC §2b — adjacent to this contract, listed
in `openapi.yml` as provisional); whether `meta.visibilityCounts` ships.

## 10. How this lands

1. Backend PR (ENG-3282) implements handlers against this file and moves the YAML into `src/`. Schema
   work it carries: `Survey.visibility`, `Survey.ownerId` (nullable, set null on user deletion),
   `Survey.visibilityVersion` and the pending marker, all in PostgreSQL and projected from there.
   Spec work:
   `SurveyVisibilityFields` merged into `SurveyListItem.yml` / `SurveyResource.yml` via `allOf`, the
   two path files added, new codes appended to `Problem.yml` **and** `V3_PROBLEM_CODES` in the same
   commit, list parameters added to `api_v3_surveys.yml`, the responses path descriptions gain one
   paragraph each from §7. `pnpm api:v3:bundle` and `pnpm api:v3:check` then pass, Schemathesis picks
   the new operations up automatically, and this directory is deleted.
2. Frontend (ENG-3200 onward) develops against the Prism mock of `.generated/openapi.mock.yml`, built
   by `build-mock.mjs` from the committed bundle plus this delta, and the field semantics above. `v3-surveys-client.ts` gains `visibility`, `owner`, `access` on the list item type.
3. Any change to the agreed shape is made here first while this directory exists, then mirrored in
   the ENG-3281 thread.
