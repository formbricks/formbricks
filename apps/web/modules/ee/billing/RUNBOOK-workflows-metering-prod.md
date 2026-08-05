# Runbook — Enable metered workflow runs on prod (ENG-1936 / ENG-2193 / ENG-2194)

Internal ops runbook. Turns on billing for workflow runs on Cloud (livemode Stripe) after PR #8735.
Staging already has this; prod does not.

## Background (how it works)

Three Stripe objects drive the app per Scale org:

- Availability entitlement — product feature lookup key **`workflows`** → `getIsWorkflowsEnabled(orgId)`.
- Included-volume entitlement — product feature **`workflow-runs-included-1000`** → `limits.monthly.workflowRuns`.
- Metered price — `formbricks_price_kind: workflow_runs`, attached to meter **`workflow_run_created`**.

Key facts:

- **Attaching a price to a product does NOT add it to existing subs.** Sub line items come from the app's
  `getCatalogItemsForPlan`; only new checkouts + plan changes pick up the workflow line item.
- **Entitlements (product features) auto-propagate** to every active subscriber. DB limits refresh on the
  next billing **sync** (webhook `customer.subscription.*` / `invoice.*` → `syncOrganizationBillingFromStripe`).
- **`reconcileCloudStripeSubscriptionsForOrganization` does NOT backfill line items** — existing Scale subs
  must be backfilled manually.
- The usage card's "included" number is the **price's free-tier boundary** (global catalog), not the
  entitlement. **Fail-closed:** if the workflow price is not graduated with a free first tier (finite
  `up_to`), catalog construction throws and the billing page 500s — loud, pre-invoice, by design.

## Rollout — do in order (order matters, fail-closed)

1. **Merge + deploy PR #8735.** Before a price exists, the catalog resolves the workflow price to null →
   card hidden, no line item added. No breakage. Deploy first so provisioning + fail-closed validation are
   live before any price appears.

2. **Create the meter** (prod livemode): event name **`workflow_run_created`**, display "Workflow runs".

3. **Create the metered price** on the Scale product (`prod_...` livemode):
   - `usage_type: metered`, attached to the meter from step 2.
   - **Graduated, first tier `unit_amount: 0` up to `1000`** (this boundary is what the card shows as
     "included"), then overage tier(s) per pricing.
   - metadata: `formbricks_price_kind: workflow_runs`, `formbricks_interval: monthly`.
   - Exactly **one** active such price per plan (a duplicate → catalog throws "found 2").

4. **Attach 2 product features** to the Scale product:
   - `workflows` (availability).
   - `workflow-runs-included-1000` (included volume; boundary must match the price's free tier = 1000).

5. **Backfill existing Scale subs** — one metered line item each (no quantity):
   ```
   stripe subscription_items create --subscription <sub_id> --price <workflow_price_id>
   ```
   Script over every active Scale sub. Idempotent: skip subs that already have the workflow price.

6. **Refresh DB limits** for existing orgs: step 5 fires `customer.subscription.updated` → sync runs
   automatically. Otherwise trigger a forced sync per org.

## How it starts working for existing Scale customers

| Concern | Auto / manual | Reflects when |
| --- | --- | --- |
| Availability (`workflows`) | Auto — feature grants entitlement to all active subscribers | Next billing sync |
| Included-volume limit | Auto — same | Next billing sync |
| Usage card shows | Auto — reads global catalog price free-tier | Price active + code deployed |
| Billing (runs → invoice) | **Manual** — line item not auto-added (reconcile doesn't backfill) | After step 5 |

Until step 5, an existing customer's runs are metered but have no subscription item → **not invoiced**.
That gap is exactly what the backfill closes.

## Verify

- New Scale checkout → sub has 3 items (base + responses + workflow_runs); billing page shows
  "Workflow Runs 0 of 1000", no error.
- Pick 1 existing (backfilled) customer → card shows included; a real run meters; upcoming invoice = $0
  within 1000, charges only overage past it.

## Guardrails

- Price MUST be graduated with a free first tier, else billing page 500s (loud, pre-invoice — intended).
- Never two active workflow prices per plan/interval.
- Deploy code before creating the price.
