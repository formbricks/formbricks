import "server-only";
import Stripe from "stripe";
import { setOrganizationPaymentAttemptError } from "./organization-billing";
import { stripeClient } from "./stripe-client";

/** The states a payment intent is left in when its on-session 3D Secure is closed or declined. */
const ABANDONED_AUTHENTICATION_STATUSES: ReadonlySet<Stripe.PaymentIntent.Status> = new Set([
  "requires_action",
  "requires_payment_method",
]);

const isStripeResourceMissing = (error: unknown): boolean =>
  error instanceof Stripe.errors.StripeInvalidRequestError && error.code === "resource_missing";

/**
 * Shows the payment-failure banner for an upgrade whose on-session authentication the billing page saw
 * abandoned or declined (Stripe does not promptly emit `payment_intent.canceled` when the 3D Secure modal is
 * closed). The page sends the payment intent's id, so it is loaded from Stripe first and recorded only when
 * it belongs to `customerId`, the organization's Stripe customer, and is still waiting for authentication
 * or a new card (ENG-7091). Any other id, one Stripe doesn't know included, records nothing. Returns whether
 * the banner was recorded.
 */
export const recordAbandonedUpgradeAuthentication = async ({
  organizationId,
  customerId,
  paymentIntentId,
}: {
  organizationId: string;
  customerId: string;
  paymentIntentId: string;
}): Promise<boolean> => {
  if (!stripeClient) return false;

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
  } catch (error) {
    if (isStripeResourceMissing(error)) return false;
    throw error;
  }

  const intentCustomerId =
    typeof paymentIntent.customer === "string" ? paymentIntent.customer : paymentIntent.customer?.id;
  if (intentCustomerId !== customerId || !ABANDONED_AUTHENTICATION_STATUSES.has(paymentIntent.status)) {
    return false;
  }

  await setOrganizationPaymentAttemptError(organizationId, {
    type: "requires_action",
    paymentIntentId: paymentIntent.id,
    message: "Payment authentication was not completed. Please try again or contact support.",
    createdAt: new Date().toISOString(),
  });
  return true;
};
