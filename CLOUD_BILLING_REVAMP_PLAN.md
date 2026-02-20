# Formbricks Cloud Billing Revamp Plan (Stripe-First, Stripe-Only End State)

## Scope

- In scope: Formbricks Cloud billing, pricing, entitlements, metering, spending controls, billing UI, and migration of existing Cloud orgs.
- Out of scope: Self-hosting license-server implementation details (but we keep the shared feature-access interface).
- Iteration 1 scope focus: new Cloud orgs only (signup -> Stripe customer creation -> upgrade flow -> entitlement-based feature access).
- Iteration 1 excludes contact limitations/metering; contacts remain unlimited for now.

## North Star

- Stripe is the commercial source of truth for **all Cloud organizations** (free, standard paid, custom paid).
- App database stores a **projection/snapshot** for performance and resilience, not an independent billing truth.
- No long-term `legacy` runtime billing branch.

## Confidence Check

- Current confidence: **~95%** for Iteration 1 start.
- Remaining uncertainty: migration details for existing paid/custom orgs (post-Iteration-1).

## 1) Current State (Repository Audit)

### Current billing module and routes

- Billing settings page routes to `apps/web/modules/ee/billing/page.tsx` via `apps/web/app/(app)/environments/[environmentId]/settings/(organization)/billing/page.tsx`.
- Stripe webhook route is `apps/web/app/api/billing/stripe-webhook/route.ts` -> `apps/web/modules/ee/billing/api/route.ts`.
- Billing confirmation page exists at `apps/web/app/(app)/billing-confirmation/page.tsx`.

### Legacy patterns to remove

- Hardcoded plans and prices in code:
  - `apps/web/modules/ee/billing/api/lib/constants.ts`
  - `apps/web/lib/constants.ts` (`PROJECT_FEATURE_KEYS`, `STRIPE_PRICE_LOOKUP_KEYS`, `BILLING_LIMITS`)
- Webhook handlers directly mutating local plan/limits:
  - `apps/web/modules/ee/billing/api/lib/checkout-session-completed.ts`
  - `apps/web/modules/ee/billing/api/lib/subscription-deleted.ts`
  - `apps/web/modules/ee/billing/api/lib/invoice-finalized.ts`
- Checkout/subscription flow is plan-key/single-price driven:
  - `apps/web/modules/ee/billing/api/lib/create-subscription.ts`

### Feature access is still scattered

- `organization.billing.plan` checks are spread across modules.
- Main permission logic appears in:
  - `apps/web/modules/ee/license-check/lib/utils.ts`
  - `apps/web/modules/survey/lib/permission.ts`
  - `apps/web/modules/survey/follow-ups/lib/utils.ts`

### Data model drift to fix

- Billing shape/types are inconsistent:
  - `packages/types/organizations.ts` uses `free/startup/custom`
  - `packages/database/zod/organizations.ts` still allows `free/startup/scale/enterprise`

## 2) Stripe Reality Check (Capabilities + Constraints)

### Stripe gives us

- Entitlements from product-feature mapping (`active_entitlements`).
- Multi-item subscriptions (flat + metered items).
- Meter events + usage summaries.
- Billing alerts (`billing.alert.triggered`).
- Checkout, trials, tax, invoicing, webhook events.

### Stripe constraints that shape implementation

- Entitlement summary webhook payload can be partial; full entitlements may require explicit list call.
- Metering is asynchronous/eventually consistent.
- Webhooks are at-least-once and unordered; idempotency + dedupe are required.
- Customer portal has limits for complex usage/multi-item plan changes.
- Stripe billing thresholds and alerts do not provide guaranteed app-level hard-stop behavior.

## 2.1) Pricing Reference (Agreed UI Baseline)

This baseline is taken from the approved pricing design screenshot shared in this thread and should be reflected in the pricing table implementation.

Billing periods:

- Monthly and annual toggle.
- Annual discount: "Get 2 months free" (annual = 10x monthly list price).

Plans:

- Hobby: `$0` (free)
- Pro: `$89/month` or `$890/year`
- Scale: `$390/month` or `$3,900/year`

Included usage (Iteration 1):

- Hobby: 1 workspace, 250 responses/month
- Pro: 3 workspaces, 2,000 responses/month
- Scale: 5 workspaces, 5,000 responses/month

Important scope note:

- Do **not** implement contact limits or contact metering in Iteration 1, even if pricing mockups mention contacts.

## 3) Target Architecture (Module-Aligned)

Create a dedicated billing domain:

- `apps/web/modules/billing/`
  - `components/`
  - `actions.ts`
  - `api/route.ts` (Stripe webhook entrypoint)
  - `lib/`
    - `stripe-client.ts`
    - `customers.ts`
    - `subscriptions.ts`
    - `entitlements.ts`
    - `pricing.ts`
    - `metering.ts`
    - `alerts.ts`
    - `spending-caps.ts`
    - `feature-access/`

Introduce unified feature-access interface:

- `FeatureAccessProvider`
  - `getEntitlements(organizationId): FeatureSet`
  - `hasFeature(organizationId, featureKey): boolean`
- Provider implementations:
  - Cloud: Stripe-backed provider
  - Self-hosted (later): license-backed provider

### Cloud runtime model

- Cloud billing provider is Stripe only.
- Keep `IS_FORMBRICKS_CLOUD=1` as gate for Cloud billing behavior.
- In Cloud mode, keep enterprise license anti-bypass checks in place.

### Data model direction

- Use one normalized billing snapshot shape for Cloud orgs.
- Keep sync metadata:
  - `lastStripeEventCreatedAt`
  - `lastSyncedAt`
  - `lastSyncedEventId`
- Optional temporary `migrationState` (`pending|ready|error`) is acceptable during rollout; remove after migration completion.
- Do not keep a permanent `legacy` billing mode branch in runtime logic.

### 3.1) Sync Model (No-Worker MVP)

1. Persist normalized billing snapshot per organization.
2. Runtime checks use cache -> DB snapshot (not Stripe per request).
3. On missing/stale snapshot, do read-through fetch from Stripe, then update DB + cache.
4. On webhook:

- verify signature
- dedupe by `event.id`
- use webhook as trigger, fetch canonical state from Stripe, overwrite snapshot
- update `lastStripeEventCreatedAt`, `lastSyncedAt`, `lastSyncedEventId`

5. Add manual "Resync from Stripe" action for self-healing.

Rationale:

- Avoids state drift from webhook ordering/retry issues.
- Avoids hard dependence on direct Stripe calls in hot paths.
- Works without worker infrastructure.

## 4) Migration Strategy (Stripe-Only End State)

### Principle

- Migrate every Cloud org to Stripe-managed billing records.
- Keep runtime simple: one Cloud billing path.

### Track A: existing free orgs (bulk, automated)

- One-off Cloud-only idempotent script:
  - create Stripe customer if missing
  - attach Stripe-managed free subscription/product
  - backfill billing snapshot + sync metadata
- Safety: `--dry-run`, explicit confirm flag, rerunnable, rate-limit backoff, per-org result log.

### Track B: existing paid/custom orgs (assisted, Stripe-first)

- Migrate contracts into Stripe catalog/subscriptions instead of app-side legacy state.
- Use a finite set of contract products/add-ons where possible to minimize catalog sprawl.
- For edge contracts, allow temporary customer-specific Stripe setup, but still Stripe-managed.
- After each org migration in Stripe:
  - trigger app resync (webhook or manual resync action)
  - mark migration `ready`

### Transitional behavior during migration window

- If org migration is `pending`, show limited billing UI with support message.
- Do not implement full alternative billing policy engine for pending orgs.
- Sunset migration state after all orgs are moved.

### Iteration 1 decision

- Migration execution scripts are explicitly out of scope for this first implementation PR.
- The PR must include:
  - a clear note that migration script implementation is deferred
  - an outline/spec of what the migration script must do (inputs, safety checks, idempotency, outputs)
- Runtime implementation target for Iteration 1:
  - new Cloud org signup creates Stripe customer automatically
  - Stripe-managed upgrade path works end-to-end
  - entitlements are synced and used for feature access decisions

## 5) Implementation Plan (Simple Phases)

1. **Foundation and cleanup boundary**

- Keep billing settings route/page shell.
- Inventory and map all `billing.plan` checks to feature keys.
- Preflight Stripe environment validation: confirm API key/CLI context points to the intended Cloud Dev Sandbox account before hardcoding or storing product/price IDs.

2. **Unified feature-access layer**

- Implement `FeatureAccessProvider`.
- Add Stripe-backed entitlement provider with cache + DB snapshot + read-through refresh.
- Start replacing direct plan checks with `hasFeature()`.

3. **Stripe customer + subscription lifecycle**

- Create Stripe customer at Cloud org creation.
- Implement multi-item subscriptions for Pro/Scale and trial flow.
- Implement immediate upgrades and period-end downgrades.

4. **Webhook + sync reliability (no-worker MVP)**

- `event.id` dedupe table.
- Canonical Stripe re-read on relevant events.
- Sync metadata writes (`lastStripeEventCreatedAt`, `lastSyncedAt`, `lastSyncedEventId`).
- Manual resync endpoint/action.

5. **Usage metering v1**

- Meter `response_created` only.
- No contact metering limits/charges in v1.
- Best-effort synchronous send + persisted failure log + replay utility.

6. **Spending controls**

- App-owned monthly spending cap (`none|warn|pause`).
- Owner-only permissions for cap changes.
- Pause/unpause implemented at app level:
  - pause blocks new responses
  - unpause resumes collection immediately

7. **Pricing + billing UI revamp**

- Pricing table from Stripe products/prices.
- Billing overview from Stripe-backed snapshot (usage, included, overage, cap state).
- For migration-pending orgs, show support/migration state messaging.

8. **Data migration and cutover**

- Defer execution of Track A and Track B to post-Iteration-1.
- In Iteration 1 PR, include migration script specification and rollout checklist.
- Remove old hardcoded billing logic and legacy webhook handlers for the new-user path.
- Keep temporary migration handling only as documentation until migration execution starts.

9. **Stabilization**

- Add monitoring for webhook lag/failures, sync freshness, metering failures.
- Add runbook for manual resync and Stripe incident fallback.

## 6) Definition Of Done (Implementation + Delivery)

Application timing:

- These gates apply when implementation work is complete and the implementation PR is ready for merge.
- They are not required for planning-only updates.

### Code-level DoD (all touched `.ts` files)

- No leftover legacy billing plan-string logic in touched code paths.
- Strong typing only (`any` avoided unless explicitly justified and documented).
- Clear module boundaries under `apps/web/modules/billing`.
- Server actions follow project return pattern (`{ data }` or `{ error }`).
- User-facing strings remain i18n-compatible.
- Caching/sync behavior follows this plan (snapshot + read-through + webhook resync).
- Tests added/updated for touched `.ts` logic.

### Quality gates (must pass)

- SonarQube coverage target: **>=80%**.
- `pnpm lint` passes.
- `pnpm test` passes.
- `pnpm build` passes.

### Git + PR workflow (mandatory)

1. Create feature branch (`codex/...`).
2. Implement in small, reviewable commits.
3. Open PR with:

- scope summary
- migration notes
- risk/rollback notes
- test evidence (`pnpm lint`, `pnpm test`, `pnpm build`)

4. Wait for CI and automated AI review (Code Rabbit).
5. Address all blocking review comments and unresolved AI findings.
6. Merge only after all required checks are green.

### Stripe preflight (before implementation merge)

- Confirm Stripe account context matches intended environment (Cloud Dev Sandbox).
- Validate that referenced product/price IDs exist in that account.
- Validate entitlement feature lookup keys used by code exist in that account.

## 7) First Slice Recommendation

- Slice A: Build Stripe-backed `FeatureAccessProvider` + snapshot/read-through path in shadow mode.
- Slice B: Rewire highest-risk feature gates (`custom-redirect-url`, `custom-links-in-surveys`).
- Slice C: Replace pricing table data source with Stripe products/prices.

## 8) Industry Best Practices Applied

1. Stripe as truth, app DB as projection.
2. Idempotent webhook ingestion with canonical re-fetch.
3. Cache + read-through to avoid per-request Stripe dependency.
4. Single policy interface (`hasFeature`) for consistent gating.
5. Migration runbooks with explicit observability and rollback controls.
6. Minimize transitional runtime branches; enforce a sunset for migration-only states.

## 9) Decision Log

| ID    | Topic                       | Decision                                                                                                     | Status    | Notes                                                |
| ----- | --------------------------- | ------------------------------------------------------------------------------------------------------------ | --------- | ---------------------------------------------------- |
| D-001 | Cloud source of truth       | Stripe is source of truth for Cloud pricing + entitlements                                                   | Confirmed | Applies to free, paid, and custom Cloud orgs         |
| D-002 | Feature gating interface    | Use `FeatureAccessProvider` (`hasFeature`) across app                                                        | Confirmed | Cloud Stripe-backed, self-hosted license-backed      |
| D-003 | Usage metering v1           | Meter `response_created` only; contacts not metered in v1                                                    | Confirmed | Contacts remain unlimited for now                    |
| D-004 | Spending cap enforcement    | App-level `none\|warn\|pause` enforcement                                                                    | Confirmed | Stripe does not provide app pause behavior           |
| D-005 | Permissions                 | Spending cap changes are owner-only                                                                          | Confirmed | Managers excluded                                    |
| D-006 | Plan change semantics       | Immediate upgrades, period-end downgrades                                                                    | Confirmed | Matches requested behavior                           |
| D-007 | Deployment separation       | Billing stack active only with `IS_FORMBRICKS_CLOUD=1`                                                       | Confirmed | Self-hosted stays license-server driven              |
| D-008 | Anti-bypass                 | In Cloud mode, keep enterprise license anti-bypass checks                                                    | Confirmed | Prevents env-var bypass                              |
| D-009 | Sync model                  | No-worker MVP: dedupe + canonical re-read + snapshot overwrite                                               | Confirmed | Worker queue deferred                                |
| D-010 | Sync metadata               | Keep both `lastStripeEventCreatedAt` and `lastSyncedAt` (+ event id)                                         | Confirmed | Ordering vs ops freshness                            |
| D-011 | Webhook payload usage       | Use webhook payload as trigger, not authoritative projection                                                 | Confirmed | Avoid out-of-order drift                             |
| D-012 | Free-tier model             | Free Cloud orgs are Stripe-managed (`$0`)                                                                    | Confirmed | Unified entitlements and upgrade path                |
| D-013 | Migration direction         | Migrate existing paid/custom orgs into Stripe-managed contracts                                              | Confirmed | Avoid permanent app-side legacy branch               |
| D-014 | Transitional runtime        | Allow temporary migration state only, with sunset                                                            | Confirmed | No long-term `legacy` policy path                    |
| D-015 | Migration execution         | Track A automated (free), Track B assisted (paid/custom)                                                     | Confirmed | Both Stripe-first                                    |
| D-016 | Currency/tax                | USD pricing with Stripe Tax enabled                                                                          | Confirmed | Tax calculation delegated to Stripe                  |
| D-017 | Stripe ownership            | Founders team owns Stripe catalog/config                                                                     | Confirmed | Process hardening to be defined                      |
| D-018 | Definition of Done          | Enforce DoD for touched `.ts` files + coverage and CI gates before merge                                     | Confirmed | Includes lint/test/build + Code Rabbit resolution    |
| D-019 | Iteration 1 migration scope | Migration script implementation is out of scope for Iteration 1 PR                                           | Confirmed | PR must state deferred status explicitly             |
| D-020 | Iteration 1 runtime target  | First implementation must be production-ready for new Cloud org signup + upgrade + entitlement gating        | Confirmed | Existing org migration follows in later phase        |
| D-021 | Pricing baseline            | Use approved pricing UI baseline: Hobby free, Pro 89/890, Scale 390/3900, annual = 2 months free             | Confirmed | Pricing table must match this reference              |
| D-022 | Contacts in Iteration 1     | No contact limits and no contact metering in Iteration 1                                                     | Confirmed | Contacts shown in old mockups are non-binding for v1 |
| D-023 | Stripe account preflight    | Before implementation wiring, confirm we are targeting the intended Cloud Dev Sandbox Stripe account and IDs | Confirmed | Avoids wiring against wrong account/catalog          |

## 10) Open Questions (Post-Iteration-1, Not Blocking Iteration 1)

1. Custom-paid migration catalog design:

- Do we define a strict finite set of contract bundles/add-ons in Stripe first, then map every paid/custom org to one of them?
- Or allow short-term customer-specific Stripe prices for outliers, then consolidate later?

2. Pending-org UX:

- Confirm exact copy and support CTA for orgs in temporary `migrationState=pending`.

## 10.1) Deferred Migration Script Specification (to include in Iteration 1 PR)

Purpose:

- Migrate existing Cloud orgs to Stripe-managed billing after Iteration 1 runtime is live.

Required behavior:

1. Guardrails:

- hard-fail unless `IS_FORMBRICKS_CLOUD=1`
- require explicit confirm flag
- support `--dry-run`

2. Free-org migration track:

- ensure Stripe customer exists
- ensure Stripe-managed free subscription exists
- backfill normalized billing snapshot + sync metadata

3. Paid/custom migration track:

- map org to Stripe contract product/add-ons
- create/update Stripe subscription as needed
- trigger canonical app resync

4. Safety:

- idempotent and rerunnable
- bounded concurrency + retry/backoff for 429/5xx
- per-org success/failure logging

5. Output:

- summary counters (migrated/skipped/failed)
- machine-readable failure report for manual follow-up

## 11) References (Stripe primary sources)

- https://docs.stripe.com/billing/entitlements
- https://docs.stripe.com/api/entitlements/active-entitlement/list
- https://docs.stripe.com/billing/subscriptions/webhooks
- https://docs.stripe.com/api/billing/alert/object
- https://docs.stripe.com/billing/subscriptions/usage-based/recording-usage-api
- https://docs.stripe.com/api/billing/meter-event/create
- https://docs.stripe.com/rate-limits
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/api/idempotent_requests
- https://docs.stripe.com/customer-management
- https://docs.stripe.com/billing/subscriptions/integrating-customer-portal

## 12) Cloud Dev Stripe Inventory Snapshot (2026-02-19)

The detailed inventory of Stripe account, product, price, meter, alert, and feature IDs is intentionally kept in an internal document (Founders Team billing ops inventory).

Public reference placeholders:

- Products: `HOBBY_PRODUCT`, `PRO_PRODUCT`, `SCALE_PRODUCT`, `TRIAL_PRODUCT`
- Base prices: `PRICE_HOBBY_MONTHLY`, `PRICE_PRO_MONTHLY`, `PRICE_PRO_YEARLY`, `PRICE_SCALE_MONTHLY`, `PRICE_SCALE_YEARLY`, `PRICE_TRIAL_FREE`
- Usage prices: `PRICE_PRO_USAGE_RESPONSES`, `PRICE_SCALE_USAGE_RESPONSES`
- Meter events: `response_created`, `unique_contact_identified` (contacts still out of Iteration 1 scope)
- Feature lookup keys follow the public keys in code (`CLOUD_STRIPE_FEATURE_LOOKUP_KEYS`)

Implementation note:

- Always paginate Stripe list APIs when validating entitlements and product feature assignments.
