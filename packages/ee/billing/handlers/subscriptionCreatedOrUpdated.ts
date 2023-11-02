import {
  getMonthlyActiveTeamPeopleCount,
  getMonthlyTeamResponseCount,
  getTeam,
  updateTeam,
} from "@formbricks/lib/team/service";
import Stripe from "stripe";
import { StripePriceLookupKeys, ProductFeatureKeys, StripeProductNames } from "../lib/constants";
import { reportUsage } from "../lib/reportUsage";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: "2023-10-16",
  maxNetworkRetries: 10,
});

export const handleSubscriptionUpdatedOrCreated = async (event: Stripe.Event) => {
  const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
  const teamId = stripeSubscriptionObject.metadata.teamId;
  if (!teamId) {
    console.error("No teamId found in subscription");
    return { status: 400, message: "skipping, no teamId found" };
  }

  const team = await getTeam(teamId);
  if (!team) throw new Error("Team not found.");
  let updatedFeatures = team.billing.features;

  for (const item of stripeSubscriptionObject.items.data) {
    const product = await stripe.products.retrieve(item.price.product as string);

    switch (product.name) {
      case StripeProductNames.inAppSurvey:
        if (
          !(
            stripeSubscriptionObject.cancel_at_period_end &&
            team.billing.features.inAppSurvey.status === "cancelled"
          )
        ) {
          updatedFeatures.inAppSurvey.status = "active";
        }
        if (
          item.price.lookup_key === StripePriceLookupKeys.inAppSurveyUnlimited ||
          item.price.lookup_key === StripePriceLookupKeys.inAppSurveyUnlimited199
        ) {
          updatedFeatures.inAppSurvey.unlimited = true;
        } else {
          const countForTeam = await getMonthlyTeamResponseCount(team.id);

          await reportUsage(
            stripeSubscriptionObject.items.data,
            ProductFeatureKeys.inAppSurvey,
            countForTeam
          );
        }
        break;

      case StripeProductNames.linkSurvey:
        if (
          !(
            stripeSubscriptionObject.cancel_at_period_end &&
            team.billing.features.linkSurvey.status === "cancelled"
          )
        ) {
          updatedFeatures.linkSurvey.status = "active";
        }
        if (
          item.price.lookup_key === StripePriceLookupKeys.linkSurveyUnlimited ||
          item.price.lookup_key === StripePriceLookupKeys.linkSurveyUnlimited199
        ) {
          updatedFeatures.linkSurvey.unlimited = true;
        }
        break;
      case StripeProductNames.userTargeting:
        if (
          !(
            stripeSubscriptionObject.cancel_at_period_end &&
            team.billing.features.userTargeting.status === "cancelled"
          )
        ) {
          updatedFeatures.userTargeting.status = "active";
        }
        if (
          item.price.lookup_key === StripePriceLookupKeys.userTargetingUnlimited ||
          item.price.lookup_key === StripePriceLookupKeys.userTargetingUnlimited199
        ) {
          updatedFeatures.userTargeting.unlimited = true;
        } else {
          const countForTeam = await getMonthlyActiveTeamPeopleCount(team.id);

          await reportUsage(
            stripeSubscriptionObject.items.data,
            ProductFeatureKeys.userTargeting,
            countForTeam
          );
        }
        break;
    }
  }

  await updateTeam(teamId, {
    billing: {
      ...team.billing,
      features: updatedFeatures,
    },
  });
};
