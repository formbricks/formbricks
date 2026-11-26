import "server-only";
import { successResponse } from "@/app/api/v3/lib/response";
import { syncOrganizationBillingFromStripeExclusively } from "@/modules/ee/billing/lib/organization-billing";
import type { TBillingPlanWaitBody } from "../schemas";
import type { TBillingPaymentMethodWaitResource, TBillingPlanWaitResource } from "../serializers";
import { type TBillingRequestContext, requireBillingAccess } from "./context";

/**
 * Stripe applies a pending upgrade a beat after the invoice's PaymentIntent succeeds, and a card saved by a
 * setup checkout is attached by an async webhook, while the billing snapshot is cached. So a wait resyncs
 * (which invalidates the cache) a few times until the value reflects, and the page shows it without a
 * manual refresh: up to 5 syncs, 1.2 s apart, within the one request.
 */
export const BILLING_SYNC_ATTEMPTS = 5;
export const BILLING_SYNC_DELAY_MS = 1200;

type TSyncedBilling = Awaited<ReturnType<typeof syncOrganizationBillingFromStripeExclusively>>;

/**
 * Re-read a value off the freshly synced billing until `isDone` holds or the attempts run out. Each sync
 * takes the organization's billing lock; one that finds it held reads the stored snapshot instead, which
 * the holder is about to refresh, and the next attempt syncs again.
 */
const pollBillingSync = async <T>(
  organizationId: string,
  read: (billing: TSyncedBilling) => T,
  isDone: (value: T) => boolean
): Promise<T> => {
  let value = read(null);
  for (let attempt = 0; attempt < BILLING_SYNC_ATTEMPTS; attempt++) {
    value = read(await syncOrganizationBillingFromStripeExclusively(organizationId));
    if (isDone(value)) break;
    if (attempt < BILLING_SYNC_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, BILLING_SYNC_DELAY_MS));
    }
  }
  return value;
};

/**
 * `POST …/billing/plan-waits`: resync until the organization's plan is `targetPlan` (or the attempts run
 * out), answering the plan it ended on. A POST because every attempt writes the synced snapshot. Billing
 * managers only; audited as `subscriptionAccessed`, once per request, as the action was.
 */
export async function waitForBillingPlanOperation({
  body,
  ...context
}: TBillingRequestContext & { body: TBillingPlanWaitBody }): Promise<Response> {
  const { organizationId, requestId } = context;
  const access = await requireBillingAccess(context, {
    action: "organization.manage_billing",
    chargeStateMutation: true,
  });
  if (access instanceof Response) return access;

  const plan = await pollBillingSync(
    organizationId,
    (billing) => billing?.stripe?.plan ?? null,
    (value) => value === body.targetPlan
  );
  const resource: TBillingPlanWaitResource = { plan };
  return successResponse(resource, { requestId });
}

/**
 * `POST …/billing/payment-method-waits`: resync until the organization shows a payment method (or the
 * attempts run out), answering whether it does — a single refresh can race the webhook that attaches a
 * card saved by a setup checkout.
 */
export async function waitForBillingPaymentMethodOperation(
  context: TBillingRequestContext
): Promise<Response> {
  const { organizationId, requestId } = context;
  const access = await requireBillingAccess(context, {
    action: "organization.manage_billing",
    chargeStateMutation: true,
  });
  if (access instanceof Response) return access;

  const hasPaymentMethod = await pollBillingSync(
    organizationId,
    (billing) => billing?.stripe?.hasPaymentMethod === true,
    (value) => value
  );
  const resource: TBillingPaymentMethodWaitResource = { hasPaymentMethod };
  return successResponse(resource, { requestId });
}
