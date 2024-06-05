import Stripe from "stripe";

import { STRIPE_API_VERSION } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { getOrganization, updateOrganization } from "@formbricks/lib/organization/service";

import { ProductFeatureKeys, StripeProductNames } from "../lib/constants";
import { unsubscribeCoreAndAppSurveyFeatures, unsubscribeLinkSurveyProFeatures } from "../lib/downgradePlan";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: STRIPE_API_VERSION,
});

export const handleSubscriptionDeleted = async (event: Stripe.Event) => {
  const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
  const organizationId = stripeSubscriptionObject.metadata.organizationId;
  if (!organizationId) {
    console.error("No organizationId found in subscription");
    return { status: 400, message: "skipping, no organizationId found" };
  }

  const organization = await getOrganization(organizationId);
  if (!organization) throw new Error("Organization not found.");

  let updatedFeatures = organization.billing.features;

  for (const item of stripeSubscriptionObject.items.data) {
    const product = await stripe.products.retrieve(item.price.product as string);

    switch (product.name) {
      case StripeProductNames.inAppSurvey:
        updatedFeatures[ProductFeatureKeys.inAppSurvey as keyof typeof organization.billing.features].status =
          "inactive";
        updatedFeatures[
          ProductFeatureKeys.inAppSurvey as keyof typeof organization.billing.features
        ].unlimited = false;
        await unsubscribeCoreAndAppSurveyFeatures(organizationId);
        break;
      case StripeProductNames.linkSurvey:
        updatedFeatures[ProductFeatureKeys.linkSurvey as keyof typeof organization.billing.features].status =
          "inactive";
        updatedFeatures[
          ProductFeatureKeys.linkSurvey as keyof typeof organization.billing.features
        ].unlimited = false;
        await unsubscribeLinkSurveyProFeatures(organizationId);
        break;
      case StripeProductNames.userTargeting:
        updatedFeatures[
          ProductFeatureKeys.userTargeting as keyof typeof organization.billing.features
        ].status = "inactive";
        updatedFeatures[
          ProductFeatureKeys.userTargeting as keyof typeof organization.billing.features
        ].unlimited = false;
        break;
    }
  }

  await updateOrganization(organizationId, {
    billing: {
      ...organization.billing,
      features: updatedFeatures,
    },
  });
};
