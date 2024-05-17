import Stripe from "stripe";

import { STRIPE_API_VERSION } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { getTeam } from "@formbricks/lib/team/service";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

export const isSubscriptionCancelled = async (
  teamId: string
): Promise<{
  cancelled: boolean;
  date: Date | null;
}> => {
  try {
    const team = await getTeam(teamId);
    if (!team) throw new Error("Team not found.");
    let isNewTeam =
      !team.billing.stripeCustomerId || !(await stripe.customers.retrieve(team.billing.stripeCustomerId));

    if (!team.billing.stripeCustomerId || isNewTeam) {
      return {
        cancelled: false,
        date: null,
      };
    }

    const subscriptions = await stripe.subscriptions.list({
      customer: team.billing.stripeCustomerId,
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
    console.error(err);
    return {
      cancelled: false,
      date: null,
    };
  }
};
