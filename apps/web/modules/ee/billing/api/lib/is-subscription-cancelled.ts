import { STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";
import { getOrganization } from "@/lib/organization/service";
import Stripe from "stripe";
import { logger } from "@formbricks/logger";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

const getCancellationDate = (subscription: Stripe.Subscription): Date | null => {
  if (subscription.status === "canceled" && subscription.canceled_at) {
    return new Date(subscription.canceled_at * 1000);
  }
  if (subscription.cancel_at_period_end && subscription.cancel_at) {
    return new Date(subscription.cancel_at * 1000);
  }
  // Fallback for cancel_at_period_end if cancel_at is not set, use current_period_end
  if (subscription.cancel_at_period_end && subscription.current_period_end) {
    return new Date(subscription.current_period_end * 1000);
  }
  return null;
};

export const isSubscriptionCancelled = async (
  organizationId: string
): Promise<{
  cancelled: boolean;
  date: Date | null;
  status?: number;
  message?: string;
}> => {
  logger.info(`Checking subscription status for organization ID: ${organizationId}`);

  if (!env.STRIPE_SECRET_KEY) {
    logger.error("Stripe is not enabled; STRIPE_SECRET_KEY is not set.");
    return {
      cancelled: false,
      date: null,
      status: 500,
      message: "Stripe is not configured on the server.",
    };
  }

  if (!organizationId) {
    logger.warn("isSubscriptionCancelled called without organizationId.");
    return {
      cancelled: false,
      date: null,
      status: 400,
      message: "Organization ID is required.",
    };
  }

  try {
    const organization = await getOrganization(organizationId);
    if (!organization) {
      logger.warn(`Organization not found for ID: ${organizationId} in isSubscriptionCancelled.`);
      return {
        cancelled: false,
        date: null,
        status: 404,
        message: "Organization not found.",
      };
    }
    logger.debug(`Found organization: ${organization.name}`);

    if (!organization.billing?.stripeCustomerId) {
      logger.info(
        `Org ${organizationId} does not have a Stripe customer ID. Assuming no active/cancelled subscription.`
      );
      return {
        cancelled: false,
        date: null,
        status: 200,
        message: "No Stripe customer ID found for organization.",
      };
    }
    const stripeCustomerId = organization.billing.stripeCustomerId;

    try {
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      if (!customer || customer.deleted) {
        logger.warn(`Stripe customer ${stripeCustomerId} not found or deleted.`);
        return {
          cancelled: false,
          date: null,
          status: 404,
          message: "Stripe customer not found or deleted.",
        };
      }
      logger.debug(`Stripe customer ${customer.id} retrieved successfully.`);
    } catch (customerError: any) {
      logger.error(
        customerError,
        `Error retrieving Stripe customer ${stripeCustomerId}: ${customerError.message}`
      );
      return {
        cancelled: false,
        date: null,
        status: 500,
        message: `Error verifying Stripe customer: ${customerError.message}`,
      };
    }

    logger.debug(`Listing subscriptions for customer ID: ${stripeCustomerId}`);
    const subscriptions = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: "all",
    });

    if (subscriptions.data.length === 0) {
      logger.info(`No subscriptions found for customer ID: ${stripeCustomerId}`);
      return { cancelled: false, date: null, status: 200, message: "No subscriptions found." };
    }

    for (const subscription of subscriptions.data) {
      if (subscription.status === "canceled" || subscription.cancel_at_period_end) {
        const cancellationDate = getCancellationDate(subscription);
        const message =
          subscription.status === "canceled"
            ? "Subscription is cancelled."
            : "Subscription is scheduled to be cancelled at period end.";
        logger.info(
          `Subscription ${subscription.id} ${message.toLowerCase()} Date: ${cancellationDate?.toISOString()}`
        );
        return {
          cancelled: true,
          date: cancellationDate,
          status: 200,
          message,
        };
      }
    }

    logger.info(
      `No subscriptions are cancelled or set to cancel at period end for customer ID: ${stripeCustomerId}`
    );
    return {
      cancelled: false,
      date: null,
      status: 200,
      message: "No subscriptions are scheduled for cancellation.",
    };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error(error, `Error in isSubscriptionCancelled for org ${organizationId}: ${errorMessage}`);
    return {
      cancelled: false,
      date: null,
      status: 500,
      message: `Error checking subscription status: ${errorMessage}`,
    };
  }
};
