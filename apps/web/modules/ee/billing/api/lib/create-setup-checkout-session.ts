import Stripe from "stripe";
import { STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";

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
  organizationId: string
): Promise<string> => {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not enabled; STRIPE_SECRET_KEY is not set.");

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
  });

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const currency = subscription.currency ?? "usd";

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
    success_url: returnUrl,
    cancel_url: returnUrl,
    metadata: {
      organizationId,
      subscriptionId,
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout Session URL");
  }

  return session.url;
};
