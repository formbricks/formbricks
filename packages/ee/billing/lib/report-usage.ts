import Stripe from "stripe";
import { STRIPE_API_VERSION } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { PRODUCT_FEATURE_KEYS } from "./constants";

export const reportUsage = async (
  items: Stripe.SubscriptionItem[],
  lookupKey: PRODUCT_FEATURE_KEYS,
  quantity: number
) => {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not enabled; STRIPE_SECRET_KEY is not set.");

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
  });

  const subscriptionItem = items.find(
    (subItem) => subItem.price.lookup_key === PRODUCT_FEATURE_KEYS[lookupKey]
  );

  if (!subscriptionItem) {
    throw new Error(`No such product found: ${PRODUCT_FEATURE_KEYS[lookupKey]}`);
  }

  await stripe.subscriptionItems.createUsageRecord(subscriptionItem.id, {
    action: "set",
    quantity,
    timestamp: Math.floor(Date.now() / 1000),
  });
};

export const reportUsageToStripe = async (
  stripeCustomerId: string,
  usage: number,
  lookupKey: PRODUCT_FEATURE_KEYS,
  timestamp: number
) => {
  if (!env.STRIPE_SECRET_KEY) throw new Error("Stripe is not enabled; STRIPE_SECRET_KEY is not set.");

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
  });

  try {
    const subscription = await stripe.subscriptions.list({
      customer: stripeCustomerId,
    });

    const subscriptionItem = subscription.data[0].items.data.filter(
      (subItem) => subItem.price.lookup_key === PRODUCT_FEATURE_KEYS[lookupKey]
    );

    if (!subscriptionItem) {
      return { status: 400, data: "No such Product found" };
    }
    const subId = subscriptionItem[0].id;

    const usageRecord = await stripe.subscriptionItems.createUsageRecord(subId, {
      action: "set",
      quantity: usage,
      timestamp,
    });

    return { status: 200, data: usageRecord.quantity };
  } catch (error) {
    return { status: 500, data: `Something went wrong: ${error}` };
  }
};
