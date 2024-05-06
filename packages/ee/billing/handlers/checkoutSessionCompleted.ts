import Stripe from "stripe";

import { STRIPE_API_VERSION } from "@formbricks/lib/constants";
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
  apiVersion: STRIPE_API_VERSION,
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
        const isInAppSurveyUnlimited =
          item.price.lookup_key === StripePriceLookupKeys.inAppSurveyUnlimitedPlan90 ||
          item.price.lookup_key === StripePriceLookupKeys.inAppSurveyUnlimitedPlan33;
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
        break;

      case StripeProductNames.linkSurvey:
        updatedFeatures.linkSurvey.status = "active";
        const isLinkSurveyUnlimited =
          item.price.lookup_key === StripePriceLookupKeys.linkSurveyUnlimitedPlan19 ||
          item.price.lookup_key === StripePriceLookupKeys.linkSurveyUnlimitedPlan33;
        if (isLinkSurveyUnlimited) {
          updatedFeatures.linkSurvey.unlimited = true;
        }
        break;

      case StripeProductNames.userTargeting:
        updatedFeatures.userTargeting.status = "active";
        const isUserTargetingUnlimited =
          item.price.lookup_key === StripePriceLookupKeys.userTargetingUnlimitedPlan90 ||
          item.price.lookup_key === StripePriceLookupKeys.userTargetingUnlimitedPlan33;
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
        break;
    }
  }

  await updateTeam(team.id, {
    billing: {
      stripeCustomerId: stripeCustomer.id,
      features: updatedFeatures,
    },
  });

  await stripe.customers.update(stripeCustomer.id, {
    name: team.name,
    metadata: { team: team.id },
    invoice_settings: {
      default_payment_method: stripeSubscriptionObject.default_payment_method as string,
    },
  });
};
