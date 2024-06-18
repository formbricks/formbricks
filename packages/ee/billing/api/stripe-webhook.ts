import Stripe from "stripe";
import { STRIPE_API_VERSION } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { handleCheckoutSessionCompleted } from "../handlers/checkout-session-completed";
import { handleInvoiceFinalized } from "../handlers/invoice-finalized";
import { handleSubscriptionCreatedOrUpdated } from "../handlers/subscription-created-or-updated";
import { handleSubscriptionDeleted } from "../handlers/subscription-deleted";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

const webhookSecret: string = env.STRIPE_WEBHOOK_SECRET!;

export const webhookHandler = async (requestBody: string, stripeSignature: string) => {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(requestBody, stripeSignature, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    if (err! instanceof Error) console.error(err);
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
