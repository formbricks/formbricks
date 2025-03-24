import Stripe from "stripe";
import { STRIPE_API_VERSION } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { getOrganization } from "@formbricks/lib/organization/service";
import { logger } from "@formbricks/logger";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

export const isSubscriptionCancelled = async (
  organizationId: string
): Promise<{
  cancelled: boolean;
  date: Date | null;
}> => {
  try {
    const organization = await getOrganization(organizationId);
    if (!organization) throw new Error("Team not found.");
    let isNewTeam =
      !organization.billing.stripeCustomerId ||
      !(await stripe.customers.retrieve(organization.billing.stripeCustomerId));

    if (!organization.billing.stripeCustomerId || isNewTeam) {
      return {
        cancelled: false,
        date: null,
      };
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: organization.billing.stripeCustomerId,
    });

    for (const subscription of subscriptions.data) {
      if (subscription.cancel_at_period_end) {
        return {
          cancelled: true,
          date: new Date(subscription.current_period_end * 1000),
        };
      }
    }
    return {
      cancelled: false,
      date: null,
    };
  } catch (err) {
    logger.error(err, "Error checking if subscription is cancelled");
    return {
      cancelled: false,
      date: null,
    };
  }
};
