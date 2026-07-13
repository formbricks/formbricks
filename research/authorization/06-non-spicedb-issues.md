# Standalone Issues Found During Research (not SpiceDB-blocking)

> **Objective / audience.** This doc carves the discrete bugs, security/privacy holes, and tech-debt surfaced during the authorization-redesign research *out* of the SpiceDB project, so the redesign stays focused on the platform work. It is a triage handoff: each entry below is a ticket-ready block for Linear (imperative title, priority, labels, confidence, problem, evidence, impact, suggested fix, and whether it is standalone or owned by the redesign). Pointers were captured on branch `claude/workspace-auth-entity-map-7473aa` (PR #8496); line numbers are as of the July 2026 code sweep. The clean-fix references to `view_contacts` / `use_for_targeting` relations point at the companion target schema `./spicedb-schema-draft.zed`.

**This list intentionally overlaps with the Status Quo issue inventory** (its §3.C "Public-surface & machine-credential weaknesses" and the code-sweep addendum, §3.E) — it is the *actionable extract* of those sections, pulled forward so these independently-fixable defects can be ticketed and hotfixed without cluttering the SpiceDB critical path. Issue IDs (I-nn) are kept identical to the Status Quo doc for cross-referencing.

Evidence paths are repo-relative and rendered as inline code so they survive copy-paste into a ticket.

---

## I-29 — Require a signed identity on the client `user` flow

- **Priority:** P0 (Critical)
- **Labels:** `security`, `privacy`, `public-surface`, `hotfix-candidate`
- **Confidence:** High (concrete pointer + mechanism; surfaced and reproduced in the sweep)
- **Problem:** `POST /api/v1|v2/client/[workspaceId]/user` has **no caller auth** — it is keyed only by the public `workspaceId`. It upserts a `Contact` by `(workspaceId, userId)`, overwrites caller-supplied attributes, and **returns the contact's segment IDs, display history, and responded surveyIds**. This is read + write of PII with no credential; worse than I-18.
- **Evidence:** `apps/web/modules/ee/contacts/api/v1/client/[workspaceId]/user/route.ts:46`
- **Impact / failure scenario:** The `workspaceId` is embedded in the JS snippet on every customer site, so it is effectively public. Anyone who knows it can, with a guessed or known `userId`, learn a specific person's segment/survey membership and corrupt their stored attributes.
- **Suggested fix:** Require a signed identity (e.g. a JWT-bound `userId`) for the client `user` flow rather than trusting a bare `userId`; do not echo segment/display/response membership back to an unauthenticated caller.
- **Relation:** **Standalone.** The fix (signed client identity) is needed regardless of the SpiceDB work.

## I-30 — Stop billing-role users from reaching workspace product data by direct navigation

- **Priority:** P1 (High)
- **Labels:** `security`, `privacy`, `over-privilege`, `authz-inconsistency`, `hotfix-candidate`
- **Confidence:** High (independently reported by three sweep agents; the two helpers demonstrably disagree)
- **Problem:** The two workspace-access helpers **disagree**: `hasUserWorkspaceAccess` returns **true** for the billing role while `hasUserWorkspaceAccessForAction` returns **false**. The workspace **layout** gates on the former, and product pages (contacts, survey summary/responses, dashboards) do not re-check `isBilling`.
- **Evidence:** `apps/web/lib/workspace/auth.ts:44 vs :101`
- **Impact / failure scenario:** A finance user invited as *billing* can open `/workspaces/{id}/contacts` or a dashboard and read customer emails/attributes and feedback aggregates — data the billing role is not supposed to see.
- **Suggested fix:** Reconcile the two helpers to one answer for "may U access workspace W" (see Status Quo, "Where authorization is enforced today" — the flagship three-answers inconsistency), and have product pages/layout exclude the billing role from product data (re-check `isBilling`, or gate on the action-variant helper).
- **Relation:** **Standalone.** A helper-consistency fix that stands on its own; the redesign's single `can()` gateway would prevent the class recurring, but this bug should be fixed now.

## I-31 — Downgrade team roles when an org role is demoted

- **Priority:** P2 (Medium)
- **Labels:** `over-privilege`, `authz-correctness`
- **Confidence:** High (concrete pointer; missing inverse branch is unambiguous)
- **Problem:** `updateMembership` promotes **all** of a user's `TeamUser` rows to `admin` when they become owner/manager, but there is **no inverse branch** on demotion.
- **Evidence:** `apps/web/modules/ee/role-management/lib/membership.ts:41`
- **Impact / failure scenario:** A user who is promoted (owner/manager) and later demoted keeps Team Admin on **every** team — still able to manage membership and workspace links they should no longer control.
- **Suggested fix:** Add the inverse branch to `updateMembership`: on demotion from owner/manager, downgrade the auto-promoted `TeamUser` rows (or otherwise reconcile team roles to the new org role).
- **Relation:** **Standalone.**

## I-32 — Apply the creator-role clamp to org-API team creation

- **Priority:** P2 (Medium)
- **Labels:** `over-privilege`, `authz-inconsistency`, `api`
- **Confidence:** High (concrete pointer; asymmetry between the two endpoints)
- **Problem:** `POST /organizations/[id]/users` clamps to the API-key creator's **live** role, but `POST /organizations/[id]/teams` gates only on `accessControl.write` with no creator check.
- **Evidence:** `apps/web/modules/api/v2/organizations/[organizationId]/teams/route.ts:42-77`
- **Impact / failure scenario:** A key whose creator was demoted or removed **cannot** create users (fails closed) but **can still create/rename teams** — an inconsistent trust boundary that compounds the immortal-API-key problem (I-6).
- **Suggested fix:** Apply the same live-creator-role clamp used by user-creation to the team-creation endpoint (fail closed when the creator's role no longer permits it).
- **Relation:** **Standalone**, though it compounds I-6 (API-key ownership), which the redesign's service-account/PAT model (see The Foundational Questions, Q8) addresses more thoroughly.

## I-33 — Gate the attribute-key picker so the targeting builder stops leaking the contact schema

- **Priority:** P2 (Medium)
- **Labels:** `privacy`, `leak`, `contacts`
- **Confidence:** High (concrete pointer; live current-state version of the Q7a concern)
- **Problem:** The segment/targeting UI loads `getContactAttributeKeys(workspaceId)` plus sampled values for autocomplete, gated only by workspace `readWrite` (i.e. any survey editor). There is no contacts-specific role, and `isPrivate` is UI-only.
- **Evidence:** `apps/web/modules/ee/contacts/segments/components/add-filter-modal.tsx:218`
- **Impact / failure scenario:** Any survey editor can enumerate the **whole** org/workspace contact attribute schema (e.g. `salary_band`, `nps_last`) — sensitive metadata that reveals what the org tracks about people. This is the live version of the attribute-schema leak described as Q7a.
- **Suggested fix:** Interim — gate the attribute-key picker on a contacts-specific permission rather than plain `readWrite`. Clean fix — the redesign's `contact_directory` split of `view_contacts` (PII) from `use_for_targeting` (attenuated), i.e. decision D4; see `./spicedb-schema-draft.zed`.
- **Relation:** **Redesign-owned for the clean fix** (D4 / Q7a), but an interim standalone hardening (gate the picker) is possible now.

## I-34a — Migrate legacy API keys off bare unsalted SHA-256

- **Priority:** P2 (Medium)
- **Labels:** `security`, `secrets`, `hardening`, `tech-debt`
- **Confidence:** High (concrete pointer)
- **Problem:** Legacy (non-`fbk_`) API keys authenticate via bare unsalted **SHA-256** with no bcrypt step and no migration deadline — cheaper to brute-force from a DB leak than the v2 keys.
- **Evidence:** `apps/web/modules/organization/settings/api-keys/lib/api-key.ts:96-105`
- **Impact / failure scenario:** A database dump exposes legacy keys to fast offline brute-forcing/rainbow-table attack relative to the salted v2 scheme.
- **Suggested fix:** Migrate legacy keys to the hardened (`fbk_`) hashing scheme; set a migration deadline and force rotation of the remaining legacy keys.
- **Relation:** **Standalone** hardening.

## I-34b — Gate the contacts page on the `contacts` entitlement

- **Priority:** P2 (Medium)
- **Labels:** `privacy`, `entitlement`, `bug`
- **Confidence:** High (concrete pointer)
- **Problem:** The contacts page calls `getContacts` **unconditionally**, so an org whose `contacts` entitlement has lapsed can still browse stored PII.
- **Evidence:** `apps/web/modules/ee/contacts/page.tsx:21`
- **Impact / failure scenario:** After a plan downgrade/entitlement lapse, PII the org should no longer be able to access via the product remains fully browsable.
- **Suggested fix:** Check the `contacts` entitlement before loading/rendering contacts on the page (fail closed when disabled).
- **Relation:** **Standalone.** (Entitlement enforcement stays an app-level concern separate from grants — see The Foundational Questions, Q10 — so this is not SpiceDB work.)

## I-34c — Make `getWorkspaceAuth` enforce workspace access itself and fix the `isReadOnly` mislabel

- **Priority:** P3 (Low, latent)
- **Labels:** `authz-correctness`, `footgun`, `tech-debt`
- **Confidence:** High (concrete pointer; latent until a new caller reuses it)
- **Problem:** `getWorkspaceAuth` never calls `hasUserWorkspaceAccess` — it delegates the access check to the layout. Any **new** page/route that reuses it for authorization therefore admits org members with **zero** team grants, and `isReadOnly` mislabels those team-less members as writers.
- **Evidence:** `apps/web/modules/workspaces/lib/utils.ts:33`
- **Impact / failure scenario:** A future page/route that trusts `getWorkspaceAuth` for authz (reasonable assumption from the name) silently grants access to org members with no team grant, and treats them as having write access.
- **Suggested fix:** Have `getWorkspaceAuth` perform the access check itself (call `hasUserWorkspaceAccess`) rather than relying on the layout, and correct the `isReadOnly` computation. Related to I-14 (UI-gating ≠ enforcement).
- **Relation:** **Standalone**, adjacent to I-14.

## I-35 — Scope feedback-record writes/deletes to the owning workspace

- **Priority:** P1 (High)
- **Labels:** `data-integrity`, `over-privilege`, `redesign-owned`
- **Confidence:** High (concrete pointer)
- **Problem:** Beyond the I-3 read leak: `deleteFeedbackRecordAction` / `updateFeedbackRecordAction` gate on workspace `readWrite` + `assertRecordBelongsToWorkspace`, which only checks that the record's tenant is one of the caller's assigned directories. So a `readWrite` member of workspace B can **delete records created by workspace A's surveys** in a shared dataset.
- **Evidence:** `apps/web/modules/ee/unify-feedback/actions.ts:198`
- **Impact / failure scenario:** In a dataset shared across workspaces A and B, a workspace-B editor can destroy or mutate workspace-A data — because Hub records carry no workspace dimension.
- **Suggested fix:** Owned by the auth rework alongside the I-3 fix (add a workspace dimension to Hub records / scope record writes through the auth layer). Not a standalone patch.
- **Relation:** **Redesign-owned.** Same root cause as I-3 (no workspace dimension on Hub records); this rework owns it. Listed here so triage does **not** open a standalone ticket that would duplicate the redesign work — track it against the redesign instead. (See Status Quo, I-3.)

## I-24 — Encrypt integration OAuth tokens and webhook secrets at rest

- **Priority:** P1 (High)
- **Labels:** `security`, `secrets`, `hotfix-candidate`, `verified`
- **Confidence:** Verified (source explicitly "Verified 2026-07-12"; both the plaintext and the encrypted counterexample pointers were confirmed)
- **Problem:** Integration OAuth tokens for Google/Airtable/Slack and webhook secrets appear stored **unencrypted** in `config`/`secret`; only Notion, 2FA and link tokens use `ENCRYPTION_KEY`/`BETTER_AUTH_SECRET`. Whoever holds workspace access (or DB access) holds live third-party tokens.
- **Evidence:** `apps/web/lib/googleSheet/service.ts:186-199` writes `refresh_token`/`access_token` into `config.key` verbatim, whereas `apps/web/app/api/v1/integrations/notion/callback/route.ts:117` does `symmetricEncrypt(tokenData.access_token, ENCRYPTION_KEY)`.
- **Impact / failure scenario:** A DB dump leaks usable long-lived Google refresh tokens (and Airtable/Slack tokens + webhook secrets) — persistent access to customers' third-party accounts.
- **Suggested fix:** Encrypt the Google/Airtable/Slack tokens and webhook secrets at rest with `ENCRYPTION_KEY`, matching the Notion path; migrate existing rows. High-severity; hotfix candidate.
- **Relation:** **Standalone** (secrets-at-rest inconsistency; independent of the authorization model).

## I-20 — Make personal contact-link JWTs revocable and default to an expiry

- **Priority:** P2 (Medium)
- **Labels:** `security`, `public-surface`, `revocation`
- **Confidence:** High (structural fact — no per-link store exists)
- **Problem:** Personal links are effectively non-revocable — there is no per-link store; the only levers are an optional JWT expiry or rotating the global `ENCRYPTION_KEY` (which invalidates *every* link, single-use token and more). Contact deletion does not invalidate issued JWTs (render-time lookups just fail).
- **Evidence:** See Status Quo, §1.5 "Existing item-level access mechanisms" — personal contact links `/c/<jwt>`, `apps/web/modules/ee/contacts/lib/contact-survey-link.ts:36` (JWT carries encrypted `contactId`+`surveyId`, optional expiry; no per-link store).
- **Impact / failure scenario:** A leaked or over-shared personal link cannot be revoked without nuking every link/token in the system; JWTs default to no expiry, so they live indefinitely.
- **Suggested fix:** Interim — default the personal-link JWTs to a bounded expiry. Clean fix — a per-link store enabling individual revocation, which the redesign's `share_link` objects (see The Foundational Questions, Q9) provide natively.
- **Relation:** **Interim standalone** (default an expiry now); **clean revocation is redesign-owned** (Q9, per-link `share_link` principals).

## I-23 — Confirm (and, if missing, enforce) `CRON_SECRET` on cron routes

- **Priority:** P2 (Medium)
- **Labels:** `security`, `needs-confirmation`, `infra`
- **Confidence:** Needs-confirmation (source: "no enforcement site was found in this tree (grep) — verify … before assuming")
- **Problem:** `CRON_SECRET` is defined but **no enforcement site was found** in this tree. It is unclear whether cron routes are actually protected by it.
- **Evidence:** Repo-wide grep for `CRON_SECRET` usage found a definition but no enforcement site (see Status Quo, I-23). `CRON_SECRET` is optional in env validation with no confirmed enforcement site.
- **Impact / failure scenario:** If no route actually checks it, cron/maintenance endpoints may be callable by anyone; if it is enforced somewhere not found by grep, this is a no-op.
- **Suggested fix:** Confirm whether cron-route protection exists somewhere. If not, enforce `CRON_SECRET` on the cron routes and make it required in env validation.
- **Relation:** **Standalone.** First step is verification, not a fix.

## I-18 — Add a capability token to the unauthenticated client response PUT

- **Priority:** P1 (High)
- **Labels:** `security`, `public-surface`, `already-spun-off`
- **Confidence:** High (concrete pointer)
- **Problem:** `PUT /api/v1|v2/client/[workspaceId]/responses/[responseId]` has **no per-response ownership or token check** — anyone knowing a `responseId` + `workspaceId` can append data to any *unfinished* response.
- **Evidence:** `apps/web/app/api/v1/client/[workspaceId]/responses/[responseId]/lib/put-response-handler.ts:226`
- **Impact / failure scenario:** An attacker who learns/guesses a `responseId` (plus the public `workspaceId`) can inject data into someone else's in-progress response.
- **Suggested fix:** Require a capability token (e.g. suid/display-bound) on the client PUT handler. Needed regardless of the SpiceDB work.
- **Relation:** **Standalone.** ⚠️ **A fix session was already spun off (task_411d37b9).** Check for an existing PR before creating a duplicate ticket — as of this writing no open PR clearly matches (the closest, #8417 "secure prefill-from-response links", is adjacent but not the same fix); re-check before ticketing.

## I-16 — Validate that `Webhook.surveyIds` / `Invite.teamIds` belong to the authorized workspace

- **Priority:** P2 (Medium)
- **Labels:** `security`, `authz-correctness`, `api`, `already-spun-off`
- **Confidence:** High (concrete pointers on both v1 and v2 paths)
- **Problem:** `Webhook.surveyIds: String[]` has no FK: v1 stores them **verbatim with no workspace check**; v2 checks all ids share *one* workspace but **never compares it to the webhook's authorized workspace** — so a key holder can attach another workspace's surveys to a webhook. `Invite.teamIds: String[]` follows the same pattern.
- **Evidence:** v1 — `apps/web/app/api/v1/webhooks/lib/webhook.ts:23`; v2 — `apps/web/modules/api/v2/management/webhooks/route.ts:65`.
- **Impact / failure scenario:** A key holder attaches surveys (or, for invites, teams) from a workspace they are not authorized for, exfiltrating events across the workspace boundary.
- **Suggested fix:** Validate that every `surveyId`/`teamId` belongs to the webhook's / invite's authorized workspace before persisting.
- **Relation:** **Standalone.** ⚠️ **A fix session was already spun off (task_5d73954b).** Check for an existing PR before creating a duplicate ticket — as of this writing no open PR clearly matches; re-check before ticketing.

---

### Notes for triage

- **Hotfix candidates** (fix ahead of the main project): I-29, I-24, I-30, I-18. I-5/I-6 (immortal org-shared API keys) are related security-relevant items tracked in the Status Quo inventory; the code sweep's three HIGH findings map onto existing entries I-5/I-6/I-24.
- **Redesign-owned (do not double-ticket as standalone):** I-35 (with I-3), and the *clean* fix for I-33 (D4) and for I-20's revocation (Q9). Interim standalone mitigations for I-33 and I-20 are still worth a ticket.
- Line numbers are from the July 2026 sweep on branch `claude/workspace-auth-entity-map-7473aa`; confirm against `main` before landing a fix.
