import { STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";
import { handleCheckoutSessionCompleted } from "@/modules/ee/billing/api/lib/checkout-session-completed";
import { handleInvoiceFinalized } from "@/modules/ee/billing/api/lib/invoice-finalized";
import { handleSubscriptionCreatedOrUpdated } from "@/modules/ee/billing/api/lib/subscription-created-or-updated";
import { handleSubscriptionDeleted } from "@/modules/ee/billing/api/lib/subscription-deleted";
import Stripe from "stripe";
import { logger } from "@formbricks/logger";

const webhookSecret: string = env.STRIPE_WEBHOOK_SECRET!;

export const webhookHandler = async (requestBody: string, stripeSignature: string) => {
  let event: Stripe.Event;

  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
      apiVersion: STRIPE_API_VERSION,
    });
    event = stripe.webhooks.constructEvent(requestBody, stripeSignature, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    if (err! instanceof Error) logger.error(err, "Error in Stripe webhook handler");
    return { status: 400, message: `Webhook Error: ${errorMessage}` };
  }

  if (event.type === "checkout.session.completed") {
    await handleCheckoutSessionCompleted(event);
  } else if (event.type === "invoice.finalized") {
    await handleInvoiceFinalized(event);
  } else if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated"
  ) {
    await handleSubscriptionCreatedOrUpdated(event);
  } else if (event.type === "customer.subscription.deleted") {
    await handleSubscriptionDeleted(event);
  }
  return { status: 200, message: { received: true } };
};
