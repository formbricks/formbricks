import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: "2023-10-16",
});

const reportUsageToStripe = async (stripeCustomerId: string | null, metric: string) => {
  if (!stripeCustomerId) {
    return { status: 400, data: "No such stripe customer found" };
  }
  const subscription = await stripe.subscriptions.list({
    customer: stripeCustomerId,
  });
  const subscriptionItem = subscription.data[0].items.data.filter(
    (subItem) => subItem.plan.nickname === metric
  );

  if (!subscriptionItem) {
    return { status: 400, data: "No such metric found" };
  }
  const subId = subscriptionItem[0].id;

  const usageRecord = await stripe.subscriptionItems.createUsageRecord(subId, {
    quantity: 20000,
    timestamp: Math.floor(Date.now() / 1000),
  });

  return { status: 200, data: usageRecord.quantity };
};

export default reportUsageToStripe;
