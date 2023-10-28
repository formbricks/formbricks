import Stripe from "stripe";
import { priceLookupKeys } from "./products";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

export const reportUsage = async (
  items: Stripe.SubscriptionItem[],
  lookupKey: priceLookupKeys,
  quantity: number
) => {
  const subscriptionItem = items.find((subItem) => subItem.price.lookup_key === priceLookupKeys[lookupKey]);

  if (!subscriptionItem) {
    throw new Error(`No such product found: ${priceLookupKeys[lookupKey]}`);
  }

  await stripe.subscriptionItems.createUsageRecord(subscriptionItem.id, {
    action: "set",
    quantity: quantity,
    timestamp: Math.floor(Date.now() / 1000),
  });
};
