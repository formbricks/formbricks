import Stripe from "stripe";

import { STRIPE_API_VERSION } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { getOrganization, updateOrganization } from "@formbricks/lib/organization/service";

import { ProductFeatureKeys, StripeProductNames } from "../lib/constants";
import { unsubscribeCoreAndAppSurveyFeatures, unsubscribeLinkSurveyProFeatures } from "../lib/downgrade-plan";

export const handleSubscriptionDeleted = async (event: Stripe.Event) => {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not enabled; STRIPE_SECRET_KEY is not set.");

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
  });

  const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
  const organizationId = stripeSubscriptionObject.metadata.organizationId;
  if (!organizationId) {
    console.error("No organizationId found in subscription");
    return { status: 400, message: "skipping, no organizationId found" };
  }

  const organization = await getOrganization(organizationId);
  if (!organization) throw new Error("Organization not found.");

  const updatedFeatures = organization.billing.features;

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
