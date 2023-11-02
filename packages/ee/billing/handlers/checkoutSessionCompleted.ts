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
});

export const handleCheckoutSessionCompleted = async (event: Stripe.Event) => {
  const checkoutSession = event.data.object as Stripe.Checkout.Session;
  const stripeSubscriptionObject = await stripe.subscriptions.retrieve(
    checkoutSession.subscription as string
  );

  const { customer: stripeCustomer } = (await stripe.checkout.sessions.retrieve(checkoutSession.id, {
    expand: ["customer"],
  })) as { customer: Stripe.Customer };

  const team = await getTeam(stripeSubscriptionObject.metadata.teamId);
  if (!team) throw new Error("Team not found.");
  let updatedFeatures = team.billing.features;

  for (const item of stripeSubscriptionObject.items.data) {
    const product = await stripe.products.retrieve(item.price.product as string);

    switch (product.name) {
      case StripeProductNames.inAppSurvey:
        updatedFeatures.inAppSurvey.status = "active";
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
        updatedFeatures.linkSurvey.status = "active";
        if (
          item.price.lookup_key === StripePriceLookupKeys.linkSurveyUnlimited ||
          item.price.lookup_key === StripePriceLookupKeys.linkSurveyUnlimited199
        ) {
          updatedFeatures.linkSurvey.unlimited = true;
        }
        break;

      case StripeProductNames.userTargeting:
        updatedFeatures.userTargeting.status = "active";
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

  await stripe.customers.update(stripeCustomer.id, {
    name: team.name,
    metadata: { team: team.id },
  });

  await updateTeam(team.id, {
    billing: {
      stripeCustomerId: stripeCustomer.id,
      features: updatedFeatures,
    },
  });
};
