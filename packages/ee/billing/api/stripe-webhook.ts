import { getTeam, updateTeam } from "@formbricks/lib/team/service";
import { getMonthlyActivePeopleCount } from "@formbricks/lib/person/service";

import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: "2023-10-16",
});

const webhookSecret: string = process.env.STRIPE_WEBHOOK_SECRET!;

interface Subscription {
  stripeCustomerId: string | null;
  plan: "community" | "scale";
  addOns: ("removeBranding" | "customUrl")[];
}

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
    const checkoutSessionWithCustomer = await stripe.checkout.sessions.retrieve(checkoutSession.id, {
      expand: ["customer"],
    });
    const customerDetails = checkoutSessionWithCustomer.customer as Stripe.Customer;

    const customerId = customerDetails.id;
    const teamId = customerDetails.metadata.team;

    const team = await getTeam(teamId);

    const existingSubscription: Subscription = team.subscription as unknown as Subscription;
    if (!existingSubscription) {
      return { status: 400, data: "skipping, no subscription object found in team", newPlan: true };
    }

    const subscription = await stripe.subscriptions.list({
      customer: customerId,
    });

    const people = await getMonthlyActivePeopleCount(subscription.data[0].metadata.environmentId);

    const subItemId = subscription.data[0].items.data.filter((item) => item.plan.nickname === "MTU")[0].id;

    await stripe.subscriptionItems.createUsageRecord(subItemId, {
      quantity: people,
      action: "set",
      timestamp: Math.floor(Date.now() / 1000),
    });

    await updateTeam(teamId, {
      subscription: {
        addOns: existingSubscription.addOns || [],
        plan: "scale",
        stripeCustomerId: customerId,
      },
    });
  } else if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const teamId = subscription.metadata.teamId;
    if (!teamId) {
      console.error("No teamId found in subscription");
      return { status: 400, message: "skipping, no teamId found" };
    }

    const existingSubscription: Subscription = (await getTeam(teamId))
      .subscription as unknown as Subscription;

    await updateTeam(teamId, {
      subscription: {
        addOns: existingSubscription.addOns,
        plan: "community",
        stripeCustomerId: existingSubscription.stripeCustomerId,
      },
    });
  } else {
    console.warn(`🤷‍♀️ Unhandled event type: ${event.type}`);
  }
  return { status: 200, message: { received: true } };
};

export default webhookHandler;
