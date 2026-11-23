import { v4 as uuidv4 } from "uuid";
import type {
  TBillingCheckoutSessionBody,
  TBillingPlanChangeBody,
  TBillingPlanWaitBody,
  TBillingSetupCheckoutSessionBody,
  TBillingUpgradeChargePreviewQuery,
} from "@/app/api/internal/organizations/[organizationId]/billing/schemas";
import type {
  TBillingPaymentMethodWaitResource,
  TBillingPlanChangeResource,
  TBillingPlanWaitResource,
  TBillingRedirectResource,
  TBillingSetupCheckoutUpgradeResource,
  TBillingUpgradeChargePreviewResource,
} from "@/app/api/internal/organizations/[organizationId]/billing/serializers";
import { buildApiUrl, getApiData, sendApiRequest } from "@/modules/api/lib/internal-api-client";
import { V3ApiError } from "@/modules/api/lib/v3-client";

/**
 * The billing page's calls to `/api/internal/organizations/{organizationId}/billing/*`. Every write talks to
 * Stripe and some resync several times, so none has a client timeout (`timeoutMs: null`): the server
 * finishes either way, and the page waits as it did for the server actions these replace.
 */

const billingPath = (organizationId: string, resource: string) =>
  `/api/internal/organizations/${encodeURIComponent(organizationId)}/billing/${resource}`;

const write = <T>(
  organizationId: string,
  resource: string,
  body?: unknown,
  method: "POST" | "DELETE" = "POST"
) => sendApiRequest<T>(billingPath(organizationId, resource), { method, body, timeoutMs: null });

/**
 * A new key for one user intent — one click that starts a checkout or a plan change. Draw it once per click
 * and pass it to the call; the call sends it as the `Idempotency-Key`, so Stripe treats a retry of the same
 * click as the same request instead of charging or scheduling twice.
 */
export const newBillingIntentKey = (): string => uuidv4();

/** A failure with no answer from the server: the request may or may not have reached it. */
export const isBillingTransportFailure = (error: unknown): boolean =>
  error instanceof V3ApiError && error.status === 0;

/**
 * Send one intent's write with its `Idempotency-Key`, retrying once with the same key when the request got
 * no answer (a dropped connection): the key makes the retry safe, since the server replays Stripe's first
 * answer rather than writing again.
 */
const writeIntent = async <T>(
  organizationId: string,
  resource: string,
  body: unknown,
  intentKey: string
): Promise<T> => {
  const send = () =>
    sendApiRequest<T>(billingPath(organizationId, resource), {
      method: "POST",
      body,
      timeoutMs: null,
      // A Structured Field string, as the IETF Idempotency-Key draft writes it.
      headers: { "Idempotency-Key": `"${intentKey}"` },
    });
  try {
    return await send();
  } catch (error) {
    if (!isBillingTransportFailure(error)) throw error;
    return send();
  }
};

/** A Stripe customer portal session to open. */
export const createBillingPortalSession = (organizationId: string) =>
  write<TBillingRedirectResource>(organizationId, "portal-sessions");

/** A Checkout Session buying a paid plan, for an organization with no subscription yet. */
export const createPlanCheckoutSession = ({
  organizationId,
  intentKey,
  ...body
}: TBillingCheckoutSessionBody & { organizationId: string; intentKey: string }) =>
  writeIntent<TBillingRedirectResource>(organizationId, "checkout-sessions", body, intentKey);

/** A setup Checkout Session adding a card, and with `targetPlan` upgrading once it is saved. */
export const createSetupCheckoutSession = ({
  organizationId,
  intentKey,
  ...body
}: TBillingSetupCheckoutSessionBody & { organizationId: string; intentKey: string }) =>
  writeIntent<TBillingRedirectResource>(organizationId, "setup-checkout-sessions", body, intentKey);

/** What an immediate upgrade would charge now, tax included; `null` when Stripe can't price it. */
export const getUpgradeChargePreview = ({
  organizationId,
  ...query
}: TBillingUpgradeChargePreviewQuery & { organizationId: string }) =>
  getApiData<TBillingUpgradeChargePreviewResource>(
    buildApiUrl(billingPath(organizationId, "upgrade-charge-preview"), query)
  );

/** Provision the organization's Stripe customer and Hobby subscription again. */
export const retryStripeSetup = (organizationId: string) => write<undefined>(organizationId, "stripe-setups");

/** The onboarding "continue on Hobby" choice. */
export const startHobbyPlan = (organizationId: string) =>
  write<undefined>(organizationId, "hobby-subscriptions");

/** The onboarding "start the free trial" choice. */
export const startProTrial = (organizationId: string) => write<undefined>(organizationId, "pro-trials");

/** Switch the plan: applied now (maybe with an invoice to confirm) or scheduled for the period end. */
export const changeBillingPlan = ({
  organizationId,
  intentKey,
  ...body
}: TBillingPlanChangeBody & { organizationId: string; intentKey: string }) =>
  writeIntent<TBillingPlanChangeResource>(organizationId, "plan-changes", body, intentKey);

/** Undo a scheduled downgrade. */
export const undoPendingPlanChange = (organizationId: string) =>
  write<undefined>(organizationId, "pending-plan-change", undefined, "DELETE");

/** Record that the upgrade payment's 3D Secure was abandoned or declined, for the payment banner. */
export const reportUpgradePaymentIssue = ({
  organizationId,
  paymentIntentId,
}: {
  organizationId: string;
  paymentIntentId: string;
}) => write<undefined>(organizationId, "payment-issues", { paymentIntentId });

/** Finalize the upgrade a completed setup checkout carried. */
export const finalizeSetupCheckoutUpgrade = ({
  organizationId,
  checkoutSessionId,
}: {
  organizationId: string;
  checkoutSessionId: string;
}) =>
  write<TBillingSetupCheckoutUpgradeResource>(organizationId, "setup-checkout-upgrades", {
    checkoutSessionId,
  });

/** Resync (up to 5 times, 1.2 s apart, in one request) until the plan is `targetPlan`. */
export const waitForBillingPlan = ({
  organizationId,
  ...body
}: TBillingPlanWaitBody & { organizationId: string }) =>
  write<TBillingPlanWaitResource>(organizationId, "plan-waits", body);

/** Resync (bounded, in one request) until a payment method shows. */
export const waitForBillingPaymentMethod = (organizationId: string) =>
  write<TBillingPaymentMethodWaitResource>(organizationId, "payment-method-waits");

/**
 * The reason a billing write was refused, for the page's `getActionErrorMessage`: the problem's `detail`
 * (an error code such as `payment_method_required`), or `""` when the request got no problem answer, which
 * the page shows as its generic error, as it did the server actions' unexpected errors.
 */
export const getBillingErrorReason = (error: unknown): string =>
  error instanceof V3ApiError ? error.detail : "";
