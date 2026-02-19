import Stripe from "stripe";
import { logger } from "@formbricks/logger";
import { STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";
import {
  findOrganizationIdByStripeCustomerId,
  syncOrganizationBillingFromStripe,
} from "@/modules/billing/lib/organization-billing";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

const webhookSecret: string = env.STRIPE_WEBHOOK_SECRET!;
const relevantEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.finalized",
  "entitlements.active_entitlement_summary.updated",
]);

export const webhookHandler = async (requestBody: string, stripeSignature: string) => {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(requestBody, stripeSignature, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    if (err instanceof Error) logger.error(err, "Error in Stripe webhook handler");
    return { status: 400, message: `Webhook Error: ${errorMessage}` };
  }

  if (!relevantEvents.has(event.type)) {
    return { status: 200, message: { received: true } };
  }

  const eventObject = event.data.object as Stripe.Event.Data.Object;
  const metadataOrgId =
    "metadata" in eventObject &&
    eventObject.metadata &&
    typeof (eventObject.metadata as Record<string, unknown>).organizationId === "string"
      ? ((eventObject.metadata as Record<string, unknown>).organizationId as string)
      : null;
  const customerId =
    "customer" in eventObject && typeof eventObject.customer === "string" ? eventObject.customer : null;

  let organizationId = metadataOrgId;
  if (!organizationId && customerId) {
    organizationId = await findOrganizationIdByStripeCustomerId(customerId);
  }

  if (!organizationId) {
    logger.warn(
      { eventType: event.type, eventId: event.id },
      "Skipping Stripe webhook: organization not resolved"
    );
    return { status: 200, message: { received: true } };
  }

  try {
    await syncOrganizationBillingFromStripe(organizationId, {
      id: event.id,
      created: event.created,
    });
  } catch (error) {
    logger.error(
      { error, eventId: event.id, organizationId, eventType: event.type },
      "Failed to sync billing snapshot from Stripe webhook"
    );
  }

  return { status: 200, message: { received: true } };
};
