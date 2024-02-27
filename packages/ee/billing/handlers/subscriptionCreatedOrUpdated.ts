import Stripe from "stripe";

import { env } from "@formbricks/lib/env";
import {
  getMonthlyActiveTeamPeopleCount,
  getMonthlyTeamResponseCount,
  getTeam,
  updateTeam,
} from "@formbricks/lib/team/service";

import { ProductFeatureKeys, StripePriceLookupKeys, StripeProductNames } from "../lib/constants";
import { reportUsage } from "../lib/reportUsage";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: "2023-10-16",
});

const isProductScheduled = async (
  scheduledSubscriptions: Stripe.SubscriptionSchedule[],
  productName: StripeProductNames
) => {
  for (const scheduledSub of scheduledSubscriptions) {
    if (scheduledSub.phases && scheduledSub.phases.length > 0) {
      const firstPhase = scheduledSub.phases[0];
      for (const item of firstPhase.items) {
        const price = item.price as string;
        const priceObject = await stripe.prices.retrieve(price);
        const product = await stripe.products.retrieve(priceObject.product as string);
        if (product.name === productName) {
          return true;
        }
      }
    }
  }
  return false;
};

export const handleSubscriptionUpdatedOrCreated = async (event: Stripe.Event) => {
  const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
  const teamId = stripeSubscriptionObject.metadata.teamId;

  if (stripeSubscriptionObject.status !== "active") {
    return;
  }

  if (!teamId) {
    console.error("No teamId found in subscription");
    return { status: 400, message: "skipping, no teamId found" };
  }

  const team = await getTeam(teamId);
  if (!team) throw new Error("Team not found.");
  let updatedFeatures = team.billing.features;

  let scheduledSubscriptions: Stripe.SubscriptionSchedule[] = [];
  if (stripeSubscriptionObject.cancel_at_period_end) {
    const allScheduledSubscriptions = await stripe.subscriptionSchedules.list({
      customer: team.billing.stripeCustomerId as string,
    });
    scheduledSubscriptions = allScheduledSubscriptions.data.filter(
      (scheduledSub) => scheduledSub.status === "not_started"
    );
  }

  for (const item of stripeSubscriptionObject.items.data) {
    const product = await stripe.products.retrieve(item.price.product as string);

    switch (product.name) {
      case StripeProductNames.inAppSurvey:
        const isInAppSurveyUnlimited =
          item.price.lookup_key === StripePriceLookupKeys.inAppSurveyUnlimitedPlan90 ||
          item.price.lookup_key === StripePriceLookupKeys.inAppSurveyUnlimitedPlan33;

        // If the current subscription is scheduled to cancel at the end of the period
        if (stripeSubscriptionObject.cancel_at_period_end) {
          // Check if the team has a scheduled subscription for this product
          const isInAppProductScheduled = await isProductScheduled(
            scheduledSubscriptions,
            StripeProductNames.inAppSurvey
          );

          // If the team does not have a scheduled subscription for this product, we cancel the feature
          if (team.billing.features.inAppSurvey.status === "active" && !isInAppProductScheduled) {
            team.billing.features.inAppSurvey.status = "cancelled";
          }

          // If the team has a scheduled subscription for this product, we don't cancel the feature
          if (isInAppProductScheduled) {
            updatedFeatures.inAppSurvey.status = "active";
          }
        } else {
          // Current subscription is not scheduled to cancel at the end of the period
          updatedFeatures.inAppSurvey.status = "active";
          // If the current subscription is unlimited, we don't need to report usage
          if (isInAppSurveyUnlimited) {
            updatedFeatures.inAppSurvey.unlimited = true;
          } else {
            const countForTeam = await getMonthlyTeamResponseCount(team.id);
            await reportUsage(
              stripeSubscriptionObject.items.data,
              ProductFeatureKeys.inAppSurvey,
              countForTeam
            );
          }
        }
        break;

      case StripeProductNames.linkSurvey:
        const isLinkSurveyUnlimited =
          item.price.lookup_key === StripePriceLookupKeys.linkSurveyUnlimitedPlan19 ||
          item.price.lookup_key === StripePriceLookupKeys.linkSurveyUnlimitedPlan33;

        if (stripeSubscriptionObject.cancel_at_period_end) {
          const isLinkSurveyScheduled = await isProductScheduled(
            scheduledSubscriptions,
            StripeProductNames.linkSurvey
          );

          if (team.billing.features.linkSurvey.status === "active" && !isLinkSurveyScheduled) {
            team.billing.features.linkSurvey.status = "cancelled";
          }

          if (isLinkSurveyScheduled) {
            updatedFeatures.linkSurvey.status = "active";
          }
        } else {
          updatedFeatures.linkSurvey.status = "active";
          if (isLinkSurveyUnlimited) {
            updatedFeatures.inAppSurvey.unlimited = true;
          }
        }
        break;

      case StripeProductNames.userTargeting:
        const isUserTargetingUnlimited =
          item.price.lookup_key === StripePriceLookupKeys.userTargetingUnlimitedPlan90 ||
          item.price.lookup_key === StripePriceLookupKeys.userTargetingUnlimitedPlan33;

        if (stripeSubscriptionObject.cancel_at_period_end) {
          const isUserTargetingScheduled = await isProductScheduled(
            scheduledSubscriptions,
            StripeProductNames.userTargeting
          );

          if (team.billing.features.userTargeting.status === "active" && !isUserTargetingScheduled) {
            team.billing.features.userTargeting.status = "cancelled";
          }

          if (isUserTargetingScheduled) {
            updatedFeatures.userTargeting.status = "active";
          }
        } else {
          updatedFeatures.userTargeting.status = "active";
          if (isUserTargetingUnlimited) {
            updatedFeatures.userTargeting.unlimited = true;
          } else {
            const countForTeam = await getMonthlyActiveTeamPeopleCount(team.id);
            await reportUsage(
              stripeSubscriptionObject.items.data,
              ProductFeatureKeys.userTargeting,
              countForTeam
            );
          }
        }
        break;
    }
  }

  await updateTeam(teamId, {
    billing: {
      stripeCustomerId: stripeSubscriptionObject.customer as string,
      features: updatedFeatures,
    },
  });
};
