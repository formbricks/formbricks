import Stripe from "stripe";
import { logger } from "@formbricks/logger";
import {
  findOrganizationIdByStripeCustomerId,
  reconcileCloudStripeSubscriptionsForOrganization,
  syncOrganizationBillingFromStripe,
} from "@/modules/ee/billing/lib/organization-billing";
import { getStripeClient, getStripeWebhookSecret } from "./stripe-client";

const relevantEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.finalized",
  "entitlements.active_entitlement_summary.updated",
]);

const getMetadataOrganizationId = (eventObject: Stripe.Event.Data.Object): string | null => {
  if (!("metadata" in eventObject) || !eventObject.metadata) {
    return null;
  }

  const { organizationId } = eventObject.metadata as Record<string, unknown>;
  return typeof organizationId === "string" ? organizationId : null;
};

const getCustomerId = (eventObject: Stripe.Event.Data.Object): string | null => {
  if (!("customer" in eventObject) || typeof eventObject.customer !== "string") {
    return null;
  }

  return eventObject.customer;
};

const getClientReferenceId = (eventObject: Stripe.Event.Data.Object): string | null => {
  if (!("client_reference_id" in eventObject) || typeof eventObject.client_reference_id !== "string") {
    return null;
  }

  return eventObject.client_reference_id;
};

const resolveOrganizationId = async (eventObject: Stripe.Event.Data.Object): Promise<string | null> => {
  const metadataOrgId = getMetadataOrganizationId(eventObject);
  if (metadataOrgId) return metadataOrgId;

  const clientReferenceId = getClientReferenceId(eventObject);
  if (clientReferenceId) return clientReferenceId;

  const customerId = getCustomerId(eventObject);
  if (!customerId) return null;

  return await findOrganizationIdByStripeCustomerId(customerId);
};

const getUnresolvedOrganizationResponse = (event: Stripe.Event) => {
  logger.warn(
    { eventType: event.type, eventId: event.id },
    "Skipping Stripe webhook: organization not resolved"
  );

  if (event.type === "checkout.session.completed") {
    return { status: 500, message: "Checkout completed but organization could not be resolved." };
  }

  return { status: 200, message: { received: true } };
};

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

  if (!relevantEvents.has(event.type)) {
    return { status: 200, message: { received: true } };
  }

  const eventObject = event.data.object as Stripe.Event.Data.Object;
  const organizationId = await resolveOrganizationId(eventObject);

  if (!organizationId) {
    return getUnresolvedOrganizationResponse(event);
  }

  try {
    await reconcileCloudStripeSubscriptionsForOrganization(organizationId, event.id);
    await syncOrganizationBillingFromStripe(organizationId, {
      id: event.id,
      created: event.created,
    });
  } catch (error) {
    logger.error(
      { error, eventId: event.id, organizationId, eventType: event.type },
      "Failed to sync billing snapshot from Stripe webhook"
    );
    return { status: 500, message: "Stripe webhook processing failed; please retry." };
  }

  return { status: 200, message: { received: true } };
};
