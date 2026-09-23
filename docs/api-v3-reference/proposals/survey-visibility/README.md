# Survey visibility — v3 API contract (proposal)

Status: **draft for agreement** · ticket ENG-3281 · milestone "API Contract" (Authorization – Phase 2)

This directory holds the API contract for private and workspace-visible surveys, agreed between backend
and frontend before either is built. It is deliberately **outside** `docs/api-v3-reference/src/`:
every operation documented there is driven against a live instance by the Schemathesis job on each
PR, and `problem-codes.test.ts` requires `Problem.yml` to list exactly the codes the code emits. A
contract for endpoints that do not exist yet cannot live there without failing both. It moves into
`src/` in the same PR that ships the handlers (see "How this lands").

- [`openapi.yml`](./openapi.yml) — self-contained OpenAPI 3.1 document for the changed and added
  operations. Lints with `pnpm exec redocly lint docs/api-v3-reference/proposals/survey-visibility/openapi.yml`.
  Mockable for ENG-3200 with `npx @stoplight/prism-cli mock docs/api-v3-reference/proposals/survey-visibility/openapi.yml`.
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
Responses follow their survey. Nothing about respondents or public collection changes.

## 2. Resource changes

Three fields are added to `SurveyListItem` and `SurveyResource`. All three are **required and always
present**, so clients never branch on absence.

| Field        | Type                           | Meaning                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `visibility` | `"private" \| "workspace"`     | The **effective** visibility: what the backend enforces on this request. See §5 for when it differs from the stored flag.                                                                                                                                                                                                                                                                                                                         |
| `owner`      | `{ id, name } \| null`         | The authorization owner (Decision 16). `null` when the author's account is gone or the survey was created with an API key. Distinct from `creator`, which stays pure attribution and is never rewritten; in Scope 1 the two coincide whenever both are non-null. `owner` is the field that ownership transfer will move later.                                                                                                                    |
| `access`     | `{ via, canChangeVisibility }` | Server-derived, per caller. `via` says why this caller can see the survey: `"workspace"` (workspace-visible and the caller has workspace read), `"owner"` (private, caller is the owner), `"organizationRole"` (private, caller reaches it only as organisation owner/manager). `canChangeVisibility` is the rendering hint for the row menu and the editor control. The backend re-checks on every mutation; the hint never authorises anything. |

`via` is chosen lowest-privilege-first: an organisation manager who is also a member of the workspace
sees `"workspace"` on a workspace-visible survey and `"organizationRole"` on a colleague's private one.
The admin banner ("This survey is private to {Name}. You can see it because you're an organisation
owner or manager") renders exactly when `visibility === "private" && access.via === "organizationRole"`.

API keys always receive `visibility: "workspace"`, `access.via: "workspace"`,
`access.canChangeVisibility: false` (K-4).

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

Authorization: `survey.read`. Same 403 as every other survey-by-id operation when the caller cannot
see the survey.

### `POST /api/v3/surveys/{surveyId}/visibility`

Body `{ "visibility": "private" | "workspace" }`. Answers **200** with the new state, `changedAt` and
`changedBy` only after the relationship change has been projected into SpiceDB inside the request
(Decision log #2). Setting the value the survey already has is a **200 no-op**: nothing written,
nothing audited, and `changedAt` / `changedBy` describe the last real change — both `null` when
there never was one, for example a `workspace` request on an API-key-created survey that is still at
its creation visibility.

| Result                                  | When                                                                                                                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 200                                     | Changed, or already at the requested value.                                                                                                                                                                                                                       |
| 400 `bad_request`                       | Malformed body, unknown value, stray query parameter.                                                                                                                                                                                                             |
| 401 `not_authenticated`                 | No credentials.                                                                                                                                                                                                                                                   |
| 403 `forbidden`                         | Caller cannot see the survey (unknown id, other workspace, private and not owner/admin), **or** caller is an API key (K-4), **or** caller sees it but may not change it (workspace member, team-level manager — R-10). One body for all, so nothing is probeable. |
| 403 `visibility_not_enabled`            | The RBAC entitlement is missing on the organisation, or the deployment's readiness marker is not set (§5). Independent of the survey, so not an existence leak.                                                                                                   |
| 409 `visibility_blocked_by_connections` | Requested `private` while `blockers[]` is non-empty. `details.blockers` repeats the list so the UI can name them without a second call.                                                                                                                           |
| 422 `visibility_change_not_allowed`     | Requested `private` on a survey with `owner: null` (Decision log #3). `detail` says to duplicate the survey for a private copy.                                                                                                                                   |
| 429 `too_many_requests`                 | Per-actor limit on visibility changes (RFC §2b: a loop of `workspace → private` must not be able to arm the freshness guard). Value set by backend; `Retry-After` present.                                                                                        |
| 503 `projection_pending`                | The survey flag was written but the SpiceDB projection did not complete in-request. The change **is** queued (outbox) and will land within 60 s or fail closed; the client re-reads `GET …/visibility` rather than retrying the POST.                             |

Authorization: a new action `survey.change_visibility` = owner (who still holds workspace read) **or**
organisation owner/manager. Not workspace write, not team-level manage. In the RFC's schema this is
`(owner & workspace->read) + workspace->administer`.

Audit: every successful change is recorded with actor, survey, old and new value (Decision 7, 11).
Proposed action name `visibilityChanged` on target `survey`.

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

| RBAC entitlement | Readiness marker | `visibility` reports           | Enforcement                                                             | `access.canChangeVisibility` | `POST …/visibility`          | Session create default |
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
`survey.manage` instead of the bare workspace ladder:

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

| Caller                                            | S is `workspace`                | S is `private`                         | `POST S/visibility` |
| ------------------------------------------------- | ------------------------------- | -------------------------------------- | ------------------- |
| Owner, member of W via a team                     | ladder                          | ladder, `via: owner`                   | allowed             |
| Owner, no longer in any team of W                 | 403                             | 403 (Decision log #3, from Decision 2) | 403                 |
| Organisation owner / manager                      | full, `via: workspace`          | full, `via: organizationRole`          | allowed             |
| Member with team-level `manage` on W (not owner)  | ladder                          | 403 (R-10)                             | 403                 |
| Member with `read` / `readWrite` on W             | ladder                          | 403                                    | 403                 |
| Billing role                                      | 403                             | 403                                    | 403                 |
| API key, any level on W                           | ladder, `visibility: workspace` | 403 (K-1)                              | 403 (K-4)           |
| Anyone, S has `owner: null`, requesting `private` | —                               | —                                      | 422                 |

Lifecycle: archive and restore keep the flag (Decision 14); delete follows `survey.delete` as today;
duplicate and copy produce a private survey owned by the actor (R-11); `createdBy` is never rewritten.

## 9. Decision log (from the ENG-3281 thread, 21 Sep)

1. **403 everywhere, unchanged.** Decision 10 / K-1 say 404; v3 answers 403 for unknown, foreign and
   forbidden ids alike, and 404 only for private surveys would make the two distinguishable. Product
   text to be amended to name no code. _Owner: Johannes._
2. **Synchronous change.** 200 only after in-request projection; 503 `projection_pending` otherwise.
   Follows the RFC over ENG-3204's pending-marker proposal. _Owner: Bhagya to confirm._
3. **Two rules not yet on the Key Decisions page.** Author who leaves the workspace loses private
   drafts there; `owner: null` surveys cannot be made private. _Owner: Johannes to record._
4. **Workflows are outbound.** Blocked like webhooks.
5. **API keys never see private surveys.** Decision 10 as revised 14 Sep; UI Design state 9 is stale.
6. **Dedicated endpoint, not PATCH.**

Not yet decided, needed before backend freeze: the per-actor rate limit value; the per-workspace survey
cap default and its error (`workspace_survey_limit_reached`, RFC §2b — adjacent to this contract, listed
in `openapi.yml` as provisional); whether `meta.visibilityCounts` ships.

## 10. How this lands

1. Backend PR (ENG-3282) implements handlers against this file and moves the YAML into `src/`:
   `SurveyVisibilityFields` merged into `SurveyListItem.yml` / `SurveyResource.yml` via `allOf`, the
   two path files added, new codes appended to `Problem.yml` **and** `V3_PROBLEM_CODES` in the same
   commit, list parameters added to `api_v3_surveys.yml`, the responses path descriptions gain one
   paragraph each from §7. `pnpm api:v3:bundle` and `pnpm api:v3:check` then pass, Schemathesis picks
   the new operations up automatically, and this directory is deleted.
2. Frontend (ENG-3200 onward) develops against the Prism mock of `openapi.yml` and the field
   semantics above. `v3-surveys-client.ts` gains `visibility`, `owner`, `access` on the list item type.
3. Any change to the agreed shape is made here first while this directory exists, then mirrored in
   the ENG-3281 thread.
