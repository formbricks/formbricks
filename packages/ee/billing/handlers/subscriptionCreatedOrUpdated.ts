import { getMonthlyActivePeopleCount } from "@formbricks/lib/person/service";
import { getProducts } from "@formbricks/lib/product/service";
import { getMonthlyResponseCount } from "@formbricks/lib/response/service";
import { getTeam, updateTeam } from "@formbricks/lib/team/service";
import Stripe from "stripe";
import { priceLookupKeys } from "../lib/products";
import { reportUsage } from "../lib/reportUsage";

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

    if (
      !(
        stripeSubscriptionObject.cancel_at_period_end &&
        team.billing.features[priceLookupKey as keyof typeof team.billing.features].status === "canceled"
      )
    ) {
      updatedFeatures[priceLookupKey as keyof typeof team.billing.features].status = "active";
    }

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
  }

  await updateTeam(teamId, {
    billing: {
      ...team.billing,
      features: updatedFeatures,
    },
  });
};
