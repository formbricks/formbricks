import { updateTeam } from "@formbricks/lib/team/service";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: "2023-10-16",
});

const successUrl =
  process.env.NODE_ENV === "production"
    ? "https://app.formbricks.com/billing-confirmation"
    : "http://localhost:3000/billing-confirmation";

function getFirstOfNextMonthTimestamp() {
  let now = new Date();
  let nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.floor(nextMonth.getTime() / 1000);
}

const createSubscription = async (teamId: string, teamName: string, failureUrl: string) => {
  try {
    const customer = await stripe.customers.create({
      name: teamName,
      metadata: {
        team: teamId,
      },
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      // first item is display and second is people
      line_items: [{ price: "price_1O5m71EKZSoSMIBYwLJVZiyX" }, { price: "price_1O5m97EKZSoSMIBYH8NRolbG" }],
      customer: customer.id,
      success_url: successUrl,
      cancel_url: failureUrl,
      allow_promotion_codes: true,
      subscription_data: {
        billing_cycle_anchor: getFirstOfNextMonthTimestamp(),
        metadata: {
          teamId,
        },
      },
    });

    await updateTeam(teamId, {
      subscription: {
        plan: "free",
        addOns: [],
        stripeCustomerId: customer.id,
      },
    });

    return { status: 200, data: "Your Plan has been upgraded!", newPlan: true, url: session.url };
  } catch (err) {
    return { status: 500, data: "Something went wrong!", newPlan: true, url: failureUrl };
  }
};

export default createSubscription;
