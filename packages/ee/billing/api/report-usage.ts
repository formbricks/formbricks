import { Metric } from "./stripe-webhook";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: "2023-10-16",
});

// rename these to people and displays in here as well as stripe

const reportUsageToStripe = async (
  stripeCustomerId: string,
  usage: number,
  metric: Metric,
  timestamp: number
) => {
  const subscription = await stripe.subscriptions.list({
    customer: "cus_OtvITcqjGW8k8V",
  });

  console.log("subscription", subscription);

  const subscriptionItem = subscription.data[0].items.data.filter(
    (subItem) => subItem.plan.nickname === Metric[metric]
  );

  if (!subscriptionItem) {
    return { status: 400, data: "No such metric found" };
  }
  const subId = subscriptionItem[0].id;

  const usageRecord = await stripe.subscriptionItems.createUsageRecord(subId, {
    action: "set",
    quantity: usage + 100000,
    timestamp: timestamp,
  });

  return { status: 200, data: usageRecord.quantity };
};

export default reportUsageToStripe;
