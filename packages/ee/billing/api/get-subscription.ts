import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: "2023-10-16",
});

interface SubscriptionIds {
  mtu?: string;
  display?: string;
}

const getUsage = async (stripeCustomerId: string | null) => {
  try {
    if (!stripeCustomerId) {
      return { status: 400, data: {}, message: "No customer provided!" };
    }
    const nextInvoice = await stripe.invoices.retrieveUpcoming({ customer: stripeCustomerId });
    const subscription = await stripe.subscriptions.list({
      customer: stripeCustomerId,
    });

    const {
      items: { data },
    } = subscription.data[0];
    const ids = data.reduce((acc: SubscriptionIds, item) => {
      if (item.plan.nickname === "MTU") acc.mtu = item.id;
      if (item.plan.nickname === "Display") acc.display = item.id;
      return acc;
    }, {});

    let mtuUsage, displayUsage;

    if (ids.display && ids.mtu) {
      [mtuUsage, displayUsage] = await Promise.all([
        stripe.subscriptionItems.listUsageRecordSummaries(ids.mtu, { limit: 1 }),
        stripe.subscriptionItems.listUsageRecordSummaries(ids.display, { limit: 1 }),
      ]);
    }

    // Check if mtuUsage and displayUsage are defined before trying to access their properties
    const paymentData = {
      mtuUsage: mtuUsage ? mtuUsage.data[0].total_usage : 0,
      displayUsage: displayUsage ? displayUsage.data[0].total_usage : 0,
      amountLeft: Math.floor(nextInvoice.amount_due / 100),
      dueDate: nextInvoice.due_date,
    };

    return { status: 200, data: paymentData, message: "Successfully sent subscription details" };
  } catch (err) {
    return { status: 500, data: {}, message: "Something went wrong" };
  }
};

export default getUsage;
