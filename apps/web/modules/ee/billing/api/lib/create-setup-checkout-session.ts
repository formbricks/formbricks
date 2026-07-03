import Stripe from "stripe";
import type { TCloudBillingInterval } from "@formbricks/types/organizations";
import { STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";

type TSetupCheckoutUpgradeIntent = {
  targetPlan: "pro" | "scale";
  targetInterval: TCloudBillingInterval;
};

/**
 * Creates a Stripe Checkout Session in `setup` mode so the customer can enter
 * a payment method, billing address, and tax ID — without creating a new subscription.
 * After completion the webhook handler attaches the payment method to the existing
 * trial subscription.
 */
export const createSetupCheckoutSession = async (
  stripeCustomerId: string,
  subscriptionId: string,
  returnUrl: string,
  organizationId: string,
  upgradeIntent?: TSetupCheckoutUpgradeIntent
): Promise<string> => {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not enabled; STRIPE_SECRET_KEY is not set.");

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
  });

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const currency = subscription.currency ?? "usd";

  // {CHECKOUT_SESSION_ID} is substituted by Stripe; the billing page uses it to finalize
  // the upgrade on-session (attach card + charge) without racing the webhook.
  const successUrl = upgradeIntent
    ? `${returnUrl}?checkout_success=1&upgrade_pending=1&session_id={CHECKOUT_SESSION_ID}`
    : `${returnUrl}?checkout_success=1`;

  const session = await stripe.checkout.sessions.create({
    mode: "setup",
    customer: stripeCustomerId,
    currency,
    billing_address_collection: "required",
    tax_id_collection: {
      enabled: true,
      required: "if_supported",
    },
    customer_update: {
      address: "auto",
      name: "auto",
    },
    success_url: successUrl,
    cancel_url: returnUrl,
    metadata: {
      organizationId,
      subscriptionId,
      ...(upgradeIntent
        ? {
            targetPlan: upgradeIntent.targetPlan,
            targetInterval: upgradeIntent.targetInterval,
          }
        : {}),
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout Session URL");
  }

  return session.url;
};
