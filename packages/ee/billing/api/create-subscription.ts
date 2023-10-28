import { getTeam, updateTeam } from "@formbricks/lib/team/service";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const successUrl =
  process.env.NODE_ENV === "production"
    ? "https://app.formbricks.com/billing-confirmation"
    : "http://localhost:3000/billing-confirmation";

const getFirstOfNextMonthTimestamp = (): number => {
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  return Math.floor(nextMonth.getTime() / 1000);
};

const createSubscription = async (teamId: string, failureUrl: string, subscribeToNickname: string) => {
  try {
    const team = await getTeam(teamId);
    let isNewTeam =
      !team.billing.stripeCustomerId || !(await stripe.customers.retrieve(team.billing.stripeCustomerId));

    const [firstPrice] = (
      await stripe.prices.list({
        lookup_keys: [subscribeToNickname],
      })
    ).data;

    if (!firstPrice) throw new Error("Price not found.");

    const lineItems = [
      {
        price: firstPrice.id,
        ...(firstPrice.billing_scheme === "per_unit" && { quantity: 1 }),
      },
    ];

    if (isNewTeam) {
      const customer = await stripe.customers.create({
        name: team.name,
        metadata: { team: teamId },
      });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: lineItems,
        customer: customer.id,
        success_url: successUrl,
        cancel_url: failureUrl,
        allow_promotion_codes: true,
        subscription_data: {
          billing_cycle_anchor: getFirstOfNextMonthTimestamp(),
          metadata: { teamId },
        },
      });

      await updateTeam(teamId, {
        billing: {
          stripeCustomerId: customer.id,
          features: team.billing.features,
        },
      });

      return { status: 200, data: "Your Plan has been upgraded!", newPlan: true, url: session.url };
    }

    const existingSubscription = (
      (await stripe.customers.retrieve(team.billing.stripeCustomerId as string, {
        expand: ["subscriptions"],
      })) as any
    ).subscriptions.data[0] as Stripe.Subscription;

    if (existingSubscription) {
      await stripe.subscriptions.update(existingSubscription.id, { items: lineItems });
    } else {
      await stripe.subscriptions.create({
        customer: team.billing.stripeCustomerId as string,
        items: lineItems,
        billing_cycle_anchor: getFirstOfNextMonthTimestamp(),
        metadata: { teamId },
      });
    }

    return {
      status: 200,
      data: "Congrats! Added to your existing subscription!",
      newPlan: false,
      url: "",
    };
  } catch (err) {
    console.error(err);
    return { status: 500, data: "Something went wrong!", newPlan: true, url: failureUrl };
  }
};

export default createSubscription;
