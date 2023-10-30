import { getMonthlyActivePeopleCount } from "@formbricks/lib/person/service";
import { getProducts } from "@formbricks/lib/product/service";
import { getMonthlyResponseCount } from "@formbricks/lib/response/service";
import { getTeam, updateTeam } from "@formbricks/lib/team/service";
import Stripe from "stripe";
import { PriceLookupKeysInStripe, ProductFeatureKeysInDb, ProductNamesInStripe } from "../lib/constants";
import { reportUsage } from "../lib/reportUsage";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: "2023-10-16",
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
  let countForTeam = 0;

  for (const item of stripeSubscriptionObject.items.data) {
    const product = await stripe.products.retrieve(item.price.product as string);

    switch (product.name) {
      case ProductNamesInStripe.appSurvey:
        if (
          !(
            stripeSubscriptionObject.cancel_at_period_end &&
            team.billing.features.appSurvey.status === "cancelled"
          )
        ) {
          updatedFeatures.appSurvey.status = "active";
        }
        if (item.price.lookup_key === PriceLookupKeysInStripe.appSurveyUnlimited) {
          updatedFeatures.appSurvey.unlimited = true;
        } else {
          const products = await getProducts(team.id);
          for (const product of products) {
            for (const environment of product.environments) {
              countForTeam += await getMonthlyResponseCount(environment.id);
            }
          }

          await reportUsage(
            stripeSubscriptionObject.items.data,
            ProductFeatureKeysInDb.appSurvey,
            countForTeam
          );
        }
        break;

      case ProductNamesInStripe.linkSurvey:
        if (
          !(
            stripeSubscriptionObject.cancel_at_period_end &&
            team.billing.features.linkSurvey.status === "cancelled"
          )
        ) {
          updatedFeatures.linkSurvey.status = "active";
        }
        if (item.price.lookup_key === PriceLookupKeysInStripe.linkSurveyUnlimited) {
          updatedFeatures.linkSurvey.unlimited = true;
        }
        break;
      case ProductNamesInStripe.userTargeting:
        if (
          !(
            stripeSubscriptionObject.cancel_at_period_end &&
            team.billing.features.userTargeting.status === "cancelled"
          )
        ) {
          updatedFeatures.userTargeting.status = "active";
        }
        if (item.price.lookup_key === PriceLookupKeysInStripe.userTargetingUnlimited) {
          updatedFeatures.userTargeting.unlimited = true;
        } else {
          const products = await getProducts(team.id);
          for (const product of products) {
            for (const environment of product.environments) {
              countForTeam += await getMonthlyActivePeopleCount(environment.id);
            }
          }

          await reportUsage(
            stripeSubscriptionObject.items.data,
            ProductFeatureKeysInDb.userTargeting,
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
