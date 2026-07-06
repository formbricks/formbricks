import Stripe from "stripe";
import { logger } from "@formbricks/logger";
import {
  findOrganizationIdByStripeCustomerId,
  reconcileCloudStripeSubscriptionsForOrganization,
  setOrganizationPaymentAttemptError,
  syncOrganizationBillingFromStripe,
} from "@/modules/ee/billing/lib/organization-billing";
import { getStripeClient, getStripeWebhookSecret } from "./stripe-client";

const relevantEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "entitlements.active_entitlement_summary.updated",
  "subscription_schedule.created",
  "subscription_schedule.updated",
  "subscription_schedule.released",
  "subscription_schedule.canceled",
  "subscription_schedule.completed",
  "payment_intent.requires_action",
  "payment_intent.canceled",
]);

/**
 * Setup-mode Checkout completed: save the provided card as the default on the customer
 * and subscription. We deliberately do NOT apply the upgrade here — the prorated charge
 * may need on-session 3D Secure, which a background webhook can't do; the billing page
 * drives the upgrade (via changeBillingPlanAction) after redirect.
 */
const handleSetupCheckoutCompleted = async (
  session: Stripe.Checkout.Session,
  stripe: Stripe
): Promise<void> => {
  if (session.mode !== "setup" || !session.setup_intent) return;

  const setupIntentId =
    typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent.id;

  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  const paymentMethodId =
    typeof setupIntent.payment_method === "string"
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id;

  if (!paymentMethodId) {
    logger.warn({ sessionId: session.id }, "Setup checkout completed but no payment method found");
    return;
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
  if (customerId) {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  const subscriptionId = session.metadata?.subscriptionId;
  if (subscriptionId) {
    await stripe.subscriptions.update(subscriptionId, {
      default_payment_method: paymentMethodId,
    });
  }
};

const handlePaymentIntentRequiresAction = async (
  paymentIntent: Stripe.PaymentIntent,
  event: { id: string; created: number }
): Promise<void> => {
  const customerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : null;
  if (!customerId) return;

  const organizationId = await findOrganizationIdByStripeCustomerId(customerId);
  if (!organizationId) return;

  await setOrganizationPaymentAttemptError(
    organizationId,
    {
      type: "requires_action",
      paymentIntentId: paymentIntent.id,
      message: "Payment requires additional authentication. Please complete verification or contact support.",
      createdAt: new Date().toISOString(),
    },
    event
  );

  logger.info(
    { paymentIntentId: paymentIntent.id, organizationId },
    "Payment intent requires action for organization"
  );
};

const handlePaymentIntentCanceled = async (
  paymentIntent: Stripe.PaymentIntent,
  event: { id: string; created: number }
): Promise<void> => {
  const customerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : null;
  if (!customerId) return;

  // Only failed-invoice cancellations are real failures; other reasons are benign (avoids a
  // false banner — every canceled event already has status "canceled").
  if (paymentIntent.cancellation_reason !== "failed_invoice") return;

  const organizationId = await findOrganizationIdByStripeCustomerId(customerId);
  if (!organizationId) return;

  await setOrganizationPaymentAttemptError(
    organizationId,
    {
      type: "failed_invoice",
      paymentIntentId: paymentIntent.id,
      message: "Payment was canceled. Please contact support to complete your upgrade.",
      createdAt: new Date().toISOString(),
    },
    event
  );

  logger.info(
    {
      paymentIntentId: paymentIntent.id,
      organizationId,
      cancellationReason: paymentIntent.cancellation_reason,
    },
    "Payment intent canceled for organization"
  );
};

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

  try {
    if (event.type === "payment_intent.requires_action") {
      await handlePaymentIntentRequiresAction(event.data.object as Stripe.PaymentIntent, {
        id: event.id,
        created: event.created,
      });
      return { status: 200, message: { received: true } };
    }

    if (event.type === "payment_intent.canceled") {
      await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent, {
        id: event.id,
        created: event.created,
      });
      return { status: 200, message: { received: true } };
    }

    const eventObject = event.data.object as Stripe.Event.Data.Object;
    const organizationId = await resolveOrganizationId(eventObject);

    if (!organizationId) {
      return getUnresolvedOrganizationResponse(event);
    }

    if (event.type === "checkout.session.completed") {
      await handleSetupCheckoutCompleted(event.data.object, stripe);
    }

    await reconcileCloudStripeSubscriptionsForOrganization(organizationId);
    await syncOrganizationBillingFromStripe(organizationId, {
      id: event.id,
      created: event.created,
    });
  } catch (error) {
    logger.error({ error, eventId: event.id, eventType: event.type }, "Failed to process Stripe webhook");
    return { status: 500, message: "Stripe webhook processing failed; please retry." };
  }

  return { status: 200, message: { received: true } };
};
