import { getTeam, updateTeam } from "@formbricks/lib/team/service";
import { getMonthlyActivePeopleCount } from "@formbricks/lib/person/service";
import { getMonthlyResponseCount } from "@formbricks/lib/response/service";
import { getProducts } from "@formbricks/lib/product/service";

import Stripe from "stripe";
import { priceLookupKeys } from "../lib/products";
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
  let priceLookupKey: string | null = null;

  for (const item of stripeSubscriptionObject.items.data) {
    switch (item.price.lookup_key) {
      case priceLookupKeys[priceLookupKeys.appSurvey]:
        priceLookupKey = priceLookupKeys[priceLookupKeys.appSurvey];
        break;
      case priceLookupKeys[priceLookupKeys.linkSurvey]:
        priceLookupKey = priceLookupKeys[priceLookupKeys.linkSurvey];
        break;
      case priceLookupKeys[priceLookupKeys.userTargeting]:
        priceLookupKey = priceLookupKeys[priceLookupKeys.userTargeting];
        break;
    }
  }

  updatedFeatures[priceLookupKey as keyof typeof team.billing.features].status = "active";

  if (priceLookupKey && priceLookupKey !== priceLookupKeys[priceLookupKeys.linkSurvey]) {
    const products = await getProducts(team.id);
    for (const product of products) {
      for (const environment of product.environments) {
        countForTeam +=
          priceLookupKey === priceLookupKeys[priceLookupKeys.userTargeting]
            ? await getMonthlyActivePeopleCount(environment.id)
            : await getMonthlyResponseCount(environment.id);
      }
    }

    await reportUsage(
      stripeSubscriptionObject.items.data,
      priceLookupKey === priceLookupKeys[priceLookupKeys.userTargeting]
        ? priceLookupKeys.userTargeting
        : priceLookupKeys.appSurvey,
      countForTeam
    );
  }

  await updateTeam(stripeCustomer.metadata.team, {
    billing: {
      stripeCustomerId: stripeCustomer.id,
      features: updatedFeatures,
    },
  });
};
