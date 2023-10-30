import { getTeam, updateTeam } from "@formbricks/lib/team/service";
import { getMonthlyActivePeopleCount } from "@formbricks/lib/person/service";
import { getMonthlyResponseCount } from "@formbricks/lib/response/service";
import { getProducts } from "@formbricks/lib/product/service";

import Stripe from "stripe";
import { PriceLookupKeysInStripe, ProductFeatureKeysInDb, ProductNamesInStripe } from "../lib/constants";
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

  const team = await getTeam(stripeCustomer.metadata.team);
  if (!team) throw new Error("Team not found.");
  let updatedFeatures = team.billing.features;
  let countForTeam = 0;

  for (const item of stripeSubscriptionObject.items.data) {
    const product = await stripe.products.retrieve(item.price.product as string);

    switch (product.name) {
      case ProductNamesInStripe.appSurvey:
        updatedFeatures.appSurvey.status = "active";
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
        updatedFeatures.linkSurvey.status = "active";
        if (item.price.lookup_key === PriceLookupKeysInStripe.linkSurveyUnlimited) {
          updatedFeatures.linkSurvey.unlimited = true;
        }
        break;

      case ProductNamesInStripe.userTargeting:
        updatedFeatures.userTargeting.status = "active";
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

  await updateTeam(stripeCustomer.metadata.team, {
    billing: {
      stripeCustomerId: stripeCustomer.id,
      features: updatedFeatures,
    },
  });
};
