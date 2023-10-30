import { ProductFeatureKeysInDb } from "./constants";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: "2023-10-16",
});

export const reportUsage = async (
  items: Stripe.SubscriptionItem[],
  lookupKey: ProductFeatureKeysInDb,
  quantity: number
) => {
  const subscriptionItem = items.find(
    (subItem) => subItem.price.lookup_key === ProductFeatureKeysInDb[lookupKey]
  );

  if (!subscriptionItem) {
    throw new Error(`No such product found: ${ProductFeatureKeysInDb[lookupKey]}`);
  }

  await stripe.subscriptionItems.createUsageRecord(subscriptionItem.id, {
    action: "set",
    quantity: quantity,
    timestamp: Math.floor(Date.now() / 1000),
  });
};

export const reportUsageToStripe = async (
  stripeCustomerId: string,
  usage: number,
  lookupKey: ProductFeatureKeysInDb,
  timestamp: number
) => {
  try {
    const subscription = await stripe.subscriptions.list({
      customer: stripeCustomerId,
    });

    const subscriptionItem = subscription.data[0].items.data.filter(
      (subItem) => subItem.price.lookup_key === ProductFeatureKeysInDb[lookupKey]
    );

    if (!subscriptionItem) {
      return { status: 400, data: "No such Product found" };
    }
    const subId = subscriptionItem[0].id;

    const usageRecord = await stripe.subscriptionItems.createUsageRecord(subId, {
      action: "set",
      quantity: usage,
      timestamp: timestamp,
    });

    return { status: 200, data: usageRecord.quantity };
  } catch (error) {
    return { status: 500, data: "Something went wrong: " + error };
  }
};

export default reportUsageToStripe;
