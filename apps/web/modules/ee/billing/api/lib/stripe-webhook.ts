import { STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";
import { handleCheckoutSessionCompleted } from "@/modules/ee/billing/api/lib/checkout-session-completed";
import { handleInvoiceFinalized } from "@/modules/ee/billing/api/lib/invoice-finalized";
import { handleSubscriptionCreatedOrUpdated } from "@/modules/ee/billing/api/lib/subscription-created-or-updated";
import { handleSubscriptionDeleted } from "@/modules/ee/billing/api/lib/subscription-deleted";
import Stripe from "stripe";
import { logger } from "@formbricks/logger";

const webhookSecret: string = env.STRIPE_WEBHOOK_SECRET!;
if (!webhookSecret) {
  logger.error("STRIPE_WEBHOOK_SECRET is not set. Webhook handler will not work.");
}

export const webhookHandler = async (requestBody: string, stripeSignature: string) => {
  let event: Stripe.Event;

  if (!webhookSecret) {
    logger.error("Stripe webhook secret is not configured.");
    return { status: 500, message: "Stripe webhook secret is not configured." };
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
    apiVersion: STRIPE_API_VERSION,
  });

  try {
    event = stripe.webhooks.constructEvent(requestBody, stripeSignature, webhookSecret);
  } catch (err: any) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error during event construction";
    logger.error(err, `Error constructing Stripe event: ${errorMessage}`);
    return { status: 400, message: `Webhook Error: ${errorMessage}` };
  }

  logger.info(`Received Stripe event: ${event.type}, ID: ${event.id}`);

  try {
    let result;
    switch (event.type) {
      case "checkout.session.completed":
        result = await handleCheckoutSessionCompleted(event);
        break;
      case "invoice.finalized":
        result = await handleInvoiceFinalized(event);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        result = await handleSubscriptionCreatedOrUpdated(event);
        break;
      case "customer.subscription.deleted":
        result = await handleSubscriptionDeleted(event);
        break;
      default:
        logger.info(`Unhandled Stripe event type: ${event.type}`);
        return { status: 200, message: { received: true, note: `Unhandled event type: ${event.type}` } };
    }

    if (result && result.status !== 200) {
      logger.warn(
        `Handler for ${event.type} (ID: ${event.id}) completed with status ${result.status}: ${JSON.stringify(result.message)}`
      );
    } else if (result) {
      logger.info(`Handler for ${event.type} (ID: ${event.id}) completed successfully.`);
    }
    return result || { status: 200, message: { received: true } };
  } catch (error: any) {
    logger.error(error, `Error processing event ${event.id} (type: ${event.type}): ${error.message}`);
    return { status: 500, message: `Error processing event: ${error.message}` };
  }
};
