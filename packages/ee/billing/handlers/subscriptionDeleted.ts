import Stripe from "stripe";

import { getTeam, updateTeam } from "@formbricks/lib/team/service";

import { LIMITS, ProductFeatureKeys } from "../lib/constants";

export const handleSubscriptionDeleted = async (event: Stripe.Event) => {
  const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
  const teamId = stripeSubscriptionObject.metadata.teamId;
  if (!teamId) {
    console.error("No teamId found in subscription");
    return { status: 400, message: "skipping, no teamId found" };
  }

  const team = await getTeam(teamId);
  if (!team) throw new Error("Team not found");

  await updateTeam(teamId, {
    billing: {
      ...team.billing,
      plan: ProductFeatureKeys.free,
      limits: {
        monthly: {
          responses: LIMITS.FREE.RESPONSES,
          miu: LIMITS.FREE.MIU,
        },
      },
    },
  });
};
