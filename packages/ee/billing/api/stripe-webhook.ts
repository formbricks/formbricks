import Stripe from "stripe";
import { handleCheckoutSessionCompleted } from "../handlers/checkoutSessionCompleted";
import { handleSubscriptionUpdatedOrCreated } from "../handlers/subscriptionCreatedOrUpdated";
import { handleSubscriptionDeleted } from "../handlers/subscriptionDeleted";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const webhookSecret: string = process.env.STRIPE_WEBHOOK_SECRET!;

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
    await handleCheckoutSessionCompleted(event);
  } else if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created"
  ) {
    await handleSubscriptionUpdatedOrCreated(event);
  } else if (event.type === "customer.subscription.deleted") {
    await handleSubscriptionDeleted(event);
  }
  return { status: 200, message: { received: true } };
};

export default webhookHandler;
