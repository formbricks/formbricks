import { getTeam, updateTeam } from "@formbricks/lib/team/service";

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
    const { line_items } = await stripe.checkout.sessions.retrieve(checkoutSession.id, {
      expand: ["line_items"],
    });

    const stripeCustomerId = checkoutSession.customer as string;
    const purchasedRemoveBranding = line_items?.data[0].description === "Test Remove Branding";
    const purchasedFormbricksScale = line_items?.data[0].description === "Test FB Cloud";
    const purchasedCustomUrl = line_items?.data[0].description === "Test Custom URL";

    const existingSubscription: Subscription = (await getTeam(teamId)) as unknown as Subscription;

    if (purchasedFormbricksScale) {
      await updateTeam(teamId, {
        subscription: {
          addOns: existingSubscription.addOns,
          plan: "scale",
          stripeCustomerId,
        },
      });
    }

    if (purchasedRemoveBranding) {
      const addOns = existingSubscription.addOns || [];
      addOns.includes("removeBranding") ? addOns.push("removeBranding") : addOns;

      await updateTeam(teamId, {
        subscription: {
          plan: existingSubscription.plan,
          stripeCustomerId,
          addOns,
        },
      });
    }

    if (purchasedCustomUrl) {
      const addOns = existingSubscription.addOns || [];
      addOns.includes("customUrl") ? addOns.push("customUrl") : addOns;

      await updateTeam(teamId, {
        subscription: {
          plan: existingSubscription.plan,
          stripeCustomerId,
          addOns,
        },
      });
    }

    const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription as string);
    await stripe.subscriptions.update(subscription.id, {
      metadata: {
        teamId,
      },
    });
  } else if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;

    const unsubscribedRemoveBranding = subscription.description === "Test Remove Branding";
    const unsubscribedFormbricksPro = subscription.description === "Test FB Cloud";
    const unsubscribedCustomUrl = subscription.description === "Test Custom URL";

    const teamId = subscription.metadata.teamId;
    if (!teamId) {
      console.error("No teamId found in subscription");
      return { status: 400, message: "skipping, no teamId found" };
    }

    const existingSubscription: Subscription = (await getTeam(teamId)) as unknown as Subscription;

    if (unsubscribedFormbricksPro) {
      await updateTeam(teamId, {
        subscription: {
          addOns: existingSubscription.addOns,
          plan: "community",
          stripeCustomerId: existingSubscription.stripeCustomerId,
        },
      });
    }

    if (unsubscribedRemoveBranding) {
      const currentAddOns = existingSubscription.addOns || [];
      const updatedAddOns = currentAddOns.filter((addOn) => addOn !== "removeBranding");

      await updateTeam(teamId, {
        subscription: {
          plan: existingSubscription.plan,
          stripeCustomerId: existingSubscription.stripeCustomerId,
          addOns: updatedAddOns,
        },
      });
    }

    if (unsubscribedCustomUrl) {
      const currentAddOns = existingSubscription.addOns || [];
      const updatedAddOns = currentAddOns.filter((addOn) => addOn !== "customUrl");

      await updateTeam(teamId, {
        subscription: {
          plan: existingSubscription.plan,
          stripeCustomerId: existingSubscription.stripeCustomerId,
          addOns: updatedAddOns,
        },
      });
    }
  } else {
    console.warn(`🤷‍♀️ Unhandled event type: ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event.
  return { status: 200, message: { received: true } };
};

export default webhookHandler;
