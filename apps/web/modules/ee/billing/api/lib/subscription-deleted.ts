import { BILLING_LIMITS, PROJECT_FEATURE_KEYS } from "@/lib/constants";
import { getOrganization, updateOrganization } from "@/lib/organization/service";
import Stripe from "stripe";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";

export const handleSubscriptionDeleted = async (event: Stripe.Event) => {
  const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
  logger.info(`Processing subscription.deleted event for subscription ID: ${stripeSubscriptionObject.id}`);

  try {
    const organizationId = stripeSubscriptionObject.metadata?.organizationId;
    if (!organizationId) {
      logger.error(
        { eventId: event.id, subscriptionId: stripeSubscriptionObject.id },
        "No organizationId found in subscription metadata."
      );
      return { status: 400, message: "Skipping event: No organizationId found in subscription metadata." };
    }

    logger.debug(`Organization ID from metadata: ${organizationId}`);

    const organization = await getOrganization(organizationId);
    if (!organization) {
      logger.warn(
        `Organization not found with ID: ${organizationId}. Subscription ID: ${stripeSubscriptionObject.id}`
      );
      return { status: 404, message: `Organization not found: ${organizationId}` };
    }
    logger.debug(`Found organization: ${organization.name}`);

    await updateOrganization(organizationId, {
      billing: {
        ...organization.billing,
        plan: PROJECT_FEATURE_KEYS.FREE,
        limits: {
          projects: BILLING_LIMITS.FREE.PROJECTS,
          monthly: {
            responses: BILLING_LIMITS.FREE.RESPONSES,
            miu: BILLING_LIMITS.FREE.MIU,
          },
        },
        stripeCustomerId: organization.billing.stripeCustomerId,
      },
    });
    logger.info(
      `Successfully processed subscription.deleted event for organization ${organizationId}. Plan downgraded to FREE.`
    );
    return { status: 200, message: "Subscription deleted and organization updated to FREE plan." };
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logger.error(
      error,
      `Error in handleSubscriptionDeleted for subscription ${stripeSubscriptionObject.id}: ${errorMessage}`
    );
    if (error instanceof ResourceNotFoundError) {
      return { status: 404, message: error.message };
    }
    return { status: 500, message: `Internal server error: ${errorMessage}` };
  }
};
