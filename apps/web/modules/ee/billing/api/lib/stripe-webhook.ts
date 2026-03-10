import Stripe from "stripe";
import { logger } from "@formbricks/logger";
import { handleCheckoutSessionCompleted } from "@/modules/ee/billing/api/lib/checkout-session-completed";
import { handleInvoiceFinalized } from "@/modules/ee/billing/api/lib/invoice-finalized";
import { handleSubscriptionDeleted } from "@/modules/ee/billing/api/lib/subscription-deleted";
import { getStripeClient, getStripeWebhookSecret } from "./stripe-client";

export const webhookHandler = async (requestBody: string, stripeSignature: string) => {
  let stripe: Stripe;
  let webhookSecret: string;
  let event: Stripe.Event;

  try {
    stripe = getStripeClient();
    webhookSecret = getStripeWebhookSecret();
  } catch (err: unknown) {
    logger.error(err, "Error getting Stripe client or webhook secret");
    logger.warn("Stripe webhook skipped: Stripe is not configured");
    return { status: 503, message: "Stripe webhook is not configured" };
  }

  try {
    event = stripe.webhooks.constructEvent(requestBody, stripeSignature, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    if (err instanceof Error) logger.error(err, "Error in Stripe webhook handler");
    return { status: 400, message: `Webhook Error: ${errorMessage}` };
  }

  if (event.type === "checkout.session.completed") {
    await handleCheckoutSessionCompleted(event);
  } else if (event.type === "invoice.finalized") {
    await handleInvoiceFinalized(event);
  } else if (event.type === "customer.subscription.deleted") {
    await handleSubscriptionDeleted(event);
  }
  return { status: 200, message: { received: true } };
};
