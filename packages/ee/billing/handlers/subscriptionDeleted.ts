import { getTeam, updateTeam } from "@formbricks/lib/team/service";
import Stripe from "stripe";
import { priceLookupKeys } from "../utils/products";

export const handleSubscriptionDeleted = async (event: Stripe.Event) => {
  const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
  const teamId = stripeSubscriptionObject.metadata.teamId;
  if (!teamId) {
    console.error("No teamId found in subscription");
    return { status: 400, message: "skipping, no teamId found" };
  }

  const team = await getTeam(teamId);
  if (!team) throw new Error("Team not found.");

  let priceLookupKey: string | null = null;
  let updatedFeatures = team.billing.features;

  for (const item of stripeSubscriptionObject.items.data) {
    switch (item.price.lookup_key) {
      case priceLookupKeys[priceLookupKeys.appSurvey]:
        priceLookupKey = priceLookupKeys[priceLookupKeys.appSurvey];
        updatedFeatures[priceLookupKey as keyof typeof team.billing.features].status = "inactive";
        break;
      case priceLookupKeys[priceLookupKeys.linkSurvey]:
        priceLookupKey = priceLookupKeys[priceLookupKeys.linkSurvey];
        updatedFeatures[priceLookupKey as keyof typeof team.billing.features].status = "inactive";
        break;
      case priceLookupKeys[priceLookupKeys.userTargeting]:
        priceLookupKey = priceLookupKeys[priceLookupKeys.userTargeting];
        updatedFeatures[priceLookupKey as keyof typeof team.billing.features].status = "inactive";
        break;
    }
  }

  await updateTeam(teamId, {
    billing: {
      stripeCustomerId: team.billing.stripeCustomerId,
      features: updatedFeatures,
    },
  });
};
