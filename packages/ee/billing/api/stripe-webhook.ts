import { updateTeam } from "@formbricks/lib/team/service";

import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: "2023-10-16",
});

const webhookSecret: string = process.env.STRIPE_WEBHOOK_SECRET!;

const webhookHandler = async (requestBody: string, stripeSignature: string) => {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(requestBody, stripeSignature, webhookSecret);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    // On error, log and return the error message.
    if (err! instanceof Error) console.log(err);
    return { status: 400, message: `Webhook Error: ${errorMessage}` };
  }

  // Cast event data to Stripe object.
  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const teamId = checkoutSession.client_reference_id;
    if (!teamId) {
      return { status: 400, message: "skipping, no teamId found" };
    }
    const stripeCustomerId = checkoutSession.customer as string;
    const plan = "pro";
    await updateTeam(teamId, { stripeCustomerId, plan });

    const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription as string);
    await stripe.subscriptions.update(subscription.id, {
      metadata: {
        teamId,
      },
    });
  } else if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const teamId = subscription.metadata.teamId;
    if (!teamId) {
      console.error("No teamId found in subscription");
      return { status: 400, message: "skipping, no teamId found" };
    }
    await updateTeam(teamId, { plan: "free" });
  } else {
    console.warn(`🤷‍♀️ Unhandled event type: ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event.
  return { status: 200, message: { received: true } };
};

export default webhookHandler;
