import { priceLookupKeys } from "../utils/products";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: "2023-10-16",
});

const reportUsageToStripe = async (
  stripeCustomerId: string,
  usage: number,
  lookupKey: priceLookupKeys,
  timestamp: number
) => {
  try {
    const subscription = await stripe.subscriptions.list({
      customer: stripeCustomerId,
    });

    const subscriptionItem = subscription.data[0].items.data.filter(
      (subItem) => subItem.price.lookup_key === priceLookupKeys[lookupKey]
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
