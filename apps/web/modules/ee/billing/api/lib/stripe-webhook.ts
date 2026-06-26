import Stripe from "stripe";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import {
  applyPendingUpgradeFromSetupCheckout,
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
 * When a setup-mode Checkout Session completes, the customer has just provided a
 * payment method + billing address.  We attach that payment method as the default
 * on the customer (for future invoices) and on the trial subscription so Stripe
 * can charge it when the trial ends.
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

  const organizationId = session.metadata?.organizationId;
  if (organizationId && customerId) {
    try {
      await applyPendingUpgradeFromSetupCheckout({
        organizationId,
        customerId,
        targetPlan: session.metadata?.targetPlan,
        targetInterval: session.metadata?.targetInterval,
      });
    } catch (error) {
      // The payment method is already attached above; the prorated upgrade invoice
      // failed to collect (declined card, SCA required, etc.). updateSubscriptionItems
      // uses `error_if_incomplete`, so the subscription is left unchanged (atomic).
      // We deliberately don't rethrow: failing the webhook would make Stripe retry the
      // whole event, re-attaching the payment method and re-attempting a charge that
      // won't succeed. The snapshot sync below still runs and keeps its retry behavior.
      logger.error(
        { error, organizationId, customerId, targetPlan: session.metadata?.targetPlan },
        "Failed to apply pending plan upgrade after setup checkout"
      );
    }
  }
};

const handlePaymentIntentRequiresAction = async (
  paymentIntent: Stripe.PaymentIntent
): Promise<void> => {
  const customerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : null;
  if (!customerId) return;

  const organizationId = await findOrganizationIdByStripeCustomerId(customerId);
  if (!organizationId) return;

  const billing = await prisma.organizationBilling.findUnique({
    where: { organizationId },
  });

  if (!billing) return;

  const currentStripeSnapshot = billing.stripe ? { ...billing.stripe } : {};

  await prisma.organizationBilling.update({
    where: { organizationId },
    data: {
      stripe: {
        ...currentStripeSnapshot,
        paymentAttemptError: {
          type: "requires_action",
          paymentIntentId: paymentIntent.id,
          message: "Payment requires additional authentication. Please update your payment method.",
          createdAt: new Date().toISOString(),
        },
        lastSyncedAt: new Date().toISOString(),
      },
    },
  });

  logger.info(
    { paymentIntentId: paymentIntent.id, organizationId },
    "Payment intent requires action for organization"
  );
};

const handlePaymentIntentCanceled = async (paymentIntent: Stripe.PaymentIntent): Promise<void> => {
  const customerId = typeof paymentIntent.customer === "string" ? paymentIntent.customer : null;
  if (!customerId) return;

  const organizationId = await findOrganizationIdByStripeCustomerId(customerId);
  if (!organizationId) return;

  const billing = await prisma.organizationBilling.findUnique({
    where: { organizationId },
  });

  if (!billing) return;

  if (
    paymentIntent.cancellation_reason === "failed_invoice" ||
    paymentIntent.status === "canceled"
  ) {
    const currentStripeSnapshot = billing.stripe ? { ...billing.stripe } : {};

    await prisma.organizationBilling.update({
      where: { organizationId },
      data: {
        stripe: {
          ...currentStripeSnapshot,
          paymentAttemptError: {
            type: "failed_invoice",
            paymentIntentId: paymentIntent.id,
            message: "Payment was canceled. Please contact support to complete your upgrade.",
            createdAt: new Date().toISOString(),
          },
          lastSyncedAt: new Date().toISOString(),
        },
      },
    });

    logger.info(
      { paymentIntentId: paymentIntent.id, organizationId, cancellationReason: paymentIntent.cancellation_reason },
      "Payment intent canceled for organization"
    );
  }
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
      await handlePaymentIntentRequiresAction(event.data.object as Stripe.PaymentIntent);
      return { status: 200, message: { received: true } };
    }

    if (event.type === "payment_intent.canceled") {
      await handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
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
    logger.error(
      { error, eventId: event.id, eventType: event.type },
      "Failed to process Stripe webhook"
    );
    return { status: 500, message: "Stripe webhook processing failed; please retry." };
  }

  return { status: 200, message: { received: true } };
};
