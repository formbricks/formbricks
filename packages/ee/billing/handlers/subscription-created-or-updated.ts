import Stripe from "stripe";

import { STRIPE_API_VERSION } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import {
  getMonthlyActiveOrganizationPeopleCount,
  getMonthlyOrganizationResponseCount,
  getOrganization,
  updateOrganization,
} from "@formbricks/lib/organization/service";

import { ProductFeatureKeys, StripePriceLookupKeys, StripeProductNames } from "../lib/constants";
import { reportUsage } from "../lib/report-usage";

const isProductScheduled = async (
  scheduledSubscriptions: Stripe.SubscriptionSchedule[],
  productName: StripeProductNames
) => {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not enabled; STRIPE_SECRET_KEY is not set.");

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
  });

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
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not enabled; STRIPE_SECRET_KEY is not set.");

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
  });

  const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
  const organizationId = stripeSubscriptionObject.metadata.organizationId;

  if (stripeSubscriptionObject.status !== "active") {
    return;
  }

  if (!organizationId) {
    console.error("No organizationId found in subscription");
    return { status: 400, message: "skipping, no organizationId found" };
  }

  const organization = await getOrganization(organizationId);
  if (!organization) throw new Error("Organization not found.");
  const updatedFeatures = organization.billing.features;

  let scheduledSubscriptions: Stripe.SubscriptionSchedule[] = [];
  if (stripeSubscriptionObject.cancel_at_period_end) {
    const allScheduledSubscriptions = await stripe.subscriptionSchedules.list({
      customer: organization.billing.stripeCustomerId!,
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
          // Check if the organization has a scheduled subscription for this product
          const isInAppProductScheduled = await isProductScheduled(
            scheduledSubscriptions,
            StripeProductNames.inAppSurvey
          );

          // If the organization does not have a scheduled subscription for this product, we cancel the feature
          if (organization.billing.features.inAppSurvey.status === "active" && !isInAppProductScheduled) {
            organization.billing.features.inAppSurvey.status = "cancelled";
          }

          // If the organization has a scheduled subscription for this product, we don't cancel the feature
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
            const countForOrganization = await getMonthlyOrganizationResponseCount(organization.id);
            await reportUsage(
              stripeSubscriptionObject.items.data,
              ProductFeatureKeys.inAppSurvey,
              countForOrganization
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

          if (organization.billing.features.linkSurvey.status === "active" && !isLinkSurveyScheduled) {
            organization.billing.features.linkSurvey.status = "cancelled";
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

          if (organization.billing.features.userTargeting.status === "active" && !isUserTargetingScheduled) {
            organization.billing.features.userTargeting.status = "cancelled";
          }

          if (isUserTargetingScheduled) {
            updatedFeatures.userTargeting.status = "active";
          }
        } else {
          updatedFeatures.userTargeting.status = "active";
          if (isUserTargetingUnlimited) {
            updatedFeatures.userTargeting.unlimited = true;
          } else {
            const countForOrganization = await getMonthlyActiveOrganizationPeopleCount(organization.id);
            await reportUsage(
              stripeSubscriptionObject.items.data,
              ProductFeatureKeys.userTargeting,
              countForOrganization
            );
          }
        }
        break;
    }
  }

  await updateOrganization(organizationId, {
    billing: {
      stripeCustomerId: stripeSubscriptionObject.customer as string,
      features: updatedFeatures,
    },
  });
};
