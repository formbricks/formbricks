import { STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";
import { getOrganization } from "@/lib/organization/service";
import Stripe from "stripe";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";

// Added logger

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: STRIPE_API_VERSION,
});

export const handleCheckoutSessionCompleted = async (event: Stripe.Event) => {
  const checkoutSession = event.data.object as Stripe.Checkout.Session;
  logger.info(`Processing checkout.session.completed event for session ID: ${checkoutSession.id}`);

  try {
    if (!checkoutSession.metadata?.organizationId) {
      logger.error("No organizationId found in checkout session metadata.", {
        sessionId: checkoutSession.id,
      });
      // No throw, return error object for webhookHandler
      return { status: 400, message: "No organizationId found in checkout session metadata" };
    }
    const organizationId = checkoutSession.metadata.organizationId;

    if (!checkoutSession.subscription) {
      logger.error("No subscription ID found in checkout session.", { sessionId: checkoutSession.id });
      return { status: 400, message: "No subscription ID found in checkout session" };
    }
    const subscriptionId = checkoutSession.subscription as string;

    const stripeSubscriptionObject = await stripe.subscriptions.retrieve(subscriptionId);
    logger.debug(`Retrieved subscription object ${subscriptionId} for session ${checkoutSession.id}`);

    // Retrieve session with expanded customer details
    const sessionWithCustomer = await stripe.checkout.sessions.retrieve(checkoutSession.id, {
      expand: ["customer"],
    });

    if (!sessionWithCustomer.customer) {
      logger.error(`Customer could not be retrieved or is missing for session ${checkoutSession.id}.`);
      return { status: 400, message: "Customer not found for checkout session" };
    }
    const stripeCustomer = sessionWithCustomer.customer as Stripe.Customer;

    const organization = await getOrganization(organizationId);
    if (!organization) {
      logger.error(`Organization not found: ${organizationId}`, { sessionId: checkoutSession.id });
      return { status: 404, message: `Organization not found: ${organizationId}` };
    }
    logger.debug(`Retrieved organization ${organization.name} for session ${checkoutSession.id}`);

    await stripe.subscriptions.update(stripeSubscriptionObject.id, {
      metadata: {
        organizationId: organization.id,
        responses: checkoutSession.metadata.responses, // Assuming these are validated or exist
        miu: checkoutSession.metadata.miu, // Assuming these are validated or exist
      },
    });
    logger.info(`Updated subscription metadata for subscription ${stripeSubscriptionObject.id}`);

    await stripe.customers.update(stripeCustomer.id, {
      name: organization.name,
      metadata: { organizationId: organization.id },
      invoice_settings: {
        default_payment_method: stripeSubscriptionObject.default_payment_method as string,
      },
    });
    logger.info(`Updated customer metadata for customer ${stripeCustomer.id}`);

    return { status: 200, message: "Checkout session completed successfully." };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error(
      error,
      `Error in handleCheckoutSessionCompleted for session ${checkoutSession.id}: ${errorMessage}`
    );
    if (error instanceof ResourceNotFoundError) {
      // Keep specific error status if it's a known type
      return { status: 404, message: error.message };
    }
    return { status: 500, message: `Internal server error: ${errorMessage}` };
  }
};
