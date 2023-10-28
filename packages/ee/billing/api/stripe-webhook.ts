import { getTeam, updateTeam } from "@formbricks/lib/team/service";
import { getMonthlyActivePeopleCount } from "@formbricks/lib/person/service";
import { getMonthlyResponseCount } from "@formbricks/lib/response/service";

import Stripe from "stripe";
import { priceLookupKeys } from "./products";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: "2023-10-16",
});

const webhookSecret: string = process.env.STRIPE_WEBHOOK_SECRET!;

const reportUsage = async (
  items: Stripe.SubscriptionItem[],
  lookupKey: priceLookupKeys,
  quantity: number
) => {
  const subscriptionItem = items.find((subItem) => subItem.price.lookup_key === priceLookupKeys[lookupKey]);

  if (!subscriptionItem) {
    throw new Error(`No such metric found: ${priceLookupKeys[lookupKey]}`);
  }

  await stripe.subscriptionItems.createUsageRecord(subscriptionItem.id, {
    action: "set",
    quantity: quantity,
    timestamp: Math.floor(Date.now() / 1000),
  });
};

const webhookHandler = async (requestBody: string, stripeSignature: string) => {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(requestBody, stripeSignature, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    if (err! instanceof Error) console.log(err);
    return { status: 400, message: `Webhook Error: ${errorMessage}` };
  }

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const stripeSubscriptionObject = await stripe.subscriptions.retrieve(
      checkoutSession.subscription as string
    );

    const { customer: stripeCustomer } = (await stripe.checkout.sessions.retrieve(checkoutSession.id, {
      expand: ["customer"],
    })) as { customer: Stripe.Customer };

    const team = await getTeam(stripeCustomer.metadata.team);
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
      for (const product of team.products) {
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
  } else if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created"
  ) {
    const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
    if (stripeSubscriptionObject.cancel_at_period_end) {
      return { status: 200, message: "skipping, subscription to be cancelled at month end" };
    }
    const teamId = stripeSubscriptionObject.metadata.teamId;
    if (!teamId) {
      console.error("No teamId found in subscription");
      return { status: 400, message: "skipping, no teamId found" };
    }

    const team = await getTeam(teamId);
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
      for (const product of team.products) {
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

    await updateTeam(teamId, {
      billing: {
        stripeCustomerId: team.billing.stripeCustomerId,
        features: updatedFeatures,
      },
    });
  } else if (event.type === "customer.subscription.deleted") {
    const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
    const teamId = stripeSubscriptionObject.metadata.teamId;
    if (!teamId) {
      console.error("No teamId found in subscription");
      return { status: 400, message: "skipping, no teamId found" };
    }

    const team = await getTeam(teamId);

    let priceLookupKey: string | null = null;
    let updatedFeatures = team.billing.features;

    for (const item of stripeSubscriptionObject.items.data) {
      switch (item.price.lookup_key) {
        case priceLookupKeys[priceLookupKeys.appSurvey]:
          priceLookupKey = priceLookupKeys[priceLookupKeys.appSurvey];
          updatedFeatures[priceLookupKey as keyof typeof team.billing.features].status = "inactive";
          break;
        case priceLookupKeys[priceLookupKeys.linkSurvey]:
          priceLookupKey = priceLookupKeys[priceLookupKeys.linkSurvey];
          updatedFeatures[priceLookupKey as keyof typeof team.billing.features].status = "inactive";
          break;
        case priceLookupKeys[priceLookupKeys.userTargeting]:
          priceLookupKey = priceLookupKeys[priceLookupKeys.userTargeting];
          updatedFeatures[priceLookupKey as keyof typeof team.billing.features].status = "inactive";
          break;
      }
    }

    await updateTeam(teamId, {
      billing: {
        stripeCustomerId: team.billing.stripeCustomerId,
        features: updatedFeatures,
      },
    });
  } else {
    console.warn(`🤷‍♀️ Unhandled event type: ${event.type}`);
  }
  return { status: 200, message: { received: true } };
};

export default webhookHandler;
