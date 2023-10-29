import { getTeam, updateTeam } from "@formbricks/lib/team/service";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const successUrl =
  process.env.NODE_ENV === "production"
    ? "https://app.formbricks.com/billing-confirmation"
    : "http://localhost:3000/billing-confirmation";

export const getFirstOfNextMonthTimestamp = (): number => {
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

    let lineItems = [
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
      if (existingSubscription.cancel_at_period_end) {
        const allScheduledSubscriptions = await stripe.subscriptionSchedules.list({
          customer: team.billing.stripeCustomerId as string,
        });
        const scheduledSubscriptions = allScheduledSubscriptions.data.filter(
          (scheduledSub) => scheduledSub.status === "not_started"
        );
        if (scheduledSubscriptions.length) {
          const existingItemsInScheduledSubscription = scheduledSubscriptions[0].phases[0].items.map(
            (item) => {
              return {
                ...(item.quantity && { quantity: item.quantity }), // Only include quantity if it's defined
                price: item.price as string,
              };
            }
          );

          const combinedLineItems = [...lineItems, ...existingItemsInScheduledSubscription];

          const uniqueItemsMap = combinedLineItems.reduce((acc, item) => {
            acc[item.price] = item; // This will overwrite duplicate items based on price
            return acc;
          }, {} as { [key: string]: { price: string; quantity?: number } });

          const lineItemsForScheduledSubscription = Object.values(uniqueItemsMap);

          await stripe.subscriptionSchedules.update(scheduledSubscriptions[0].id, {
            end_behavior: "release",
            phases: [
              {
                start_date: getFirstOfNextMonthTimestamp(),
                items: lineItemsForScheduledSubscription,
                iterations: 1,
                metadata: { teamId },
              },
            ],
            metadata: { teamId },
          });
        } else {
          await stripe.subscriptionSchedules.create({
            customer: team.billing.stripeCustomerId as string,
            start_date: getFirstOfNextMonthTimestamp(),
            end_behavior: "release",
            phases: [
              {
                items: lineItems,
                iterations: 1,
                metadata: { teamId },
              },
            ],
            metadata: { teamId },
          });
        }
      }

      if (
        !(
          existingSubscription.cancel_at_period_end &&
          team.billing.features[subscribeToNickname as keyof typeof team.billing.features].status ===
            "canceled"
        )
      ) {
        let alreadyInSubscription = false;

        existingSubscription.items.data.forEach((item) => {
          if (item.price.lookup_key === subscribeToNickname) {
            alreadyInSubscription = true;
          }
        });

        if (!alreadyInSubscription) {
          await stripe.subscriptions.update(existingSubscription.id, { items: lineItems });
        }
      }
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
