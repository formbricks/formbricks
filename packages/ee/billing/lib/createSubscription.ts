import Stripe from "stripe";

import { STRIPE_API_VERSION, WEBAPP_URL } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { getTeam } from "@formbricks/lib/team/service";

import { StripePriceLookupKeys } from "./constants";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

const baseUrl = process.env.NODE_ENV === "production" ? WEBAPP_URL : "http://localhost:3000";

export const getFirstOfNextMonthTimestamp = (): number => {
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  return Math.floor(nextMonth.getTime() / 1000);
};

export const createSubscription = async (
  teamId: string,
  environmentId: string,
  priceLookupKey: StripePriceLookupKeys
) => {
  try {
    const team = await getTeam(teamId);
    if (!team) throw new Error("Team not found.");
    let isNewTeam =
      !team.billing.stripeCustomerId || !(await stripe.customers.retrieve(team.billing.stripeCustomerId));

    const priceObject = (
      await stripe.prices.list({
        lookup_keys: [priceLookupKey],
        expand: ["data.product"],
      })
    ).data[0];

    if (!priceObject) throw new Error("Price not found");
    const responses = (priceObject.product as Stripe.Product).metadata.responses as unknown as number;
    const miu = (priceObject.product as Stripe.Product).metadata.miu as unknown as number;

    if (isNewTeam) {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            price: priceObject.id,
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/billing-confirmation?environmentId=${environmentId}`,
        cancel_url: `${baseUrl}/environments/${environmentId}/settings/billing`,
        allow_promotion_codes: true,
        subscription_data: {
          billing_cycle_anchor: getFirstOfNextMonthTimestamp(),
          metadata: { teamId },
        },
        metadata: { teamId, responses, miu },
        automatic_tax: { enabled: true },
      });

      return { status: 200, data: "Your Plan has been upgraded!", newPlan: true, url: session.url };
    }

    const existingSubscription = await stripe.subscriptions.list({
      customer: team.billing.stripeCustomerId as string,
    });

    if (existingSubscription) {
      const existingSubscriptionItem = existingSubscription.data[0].items.data[0];

      await stripe.subscriptions.update(existingSubscription.data[0].id, {
        items: [
          {
            id: existingSubscriptionItem.id,
            deleted: true,
          },
          {
            price: priceObject.id,
          },
        ],
        cancel_at_period_end: false,
      });
    }

    return {
      status: 200,
      data: "Congrats! Added to your existing subscription!",
      newPlan: false,
      url: "",
    };
  } catch (err) {
    console.error(err);
    return {
      status: 500,
      newPlan: true,
      url: `${baseUrl}/environments/${environmentId}/settings/billing`,
    };
  }
};
