import { getTeam, updateTeam } from "@formbricks/lib/team/service";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const baseUrl =
  process.env.NODE_ENV === "production" ? "https://app.formbricks.com" : "http://localhost:3000";

export const getFirstOfNextMonthTimestamp = (): number => {
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  return Math.floor(nextMonth.getTime() / 1000);
};

export const createSubscription = async (
  teamId: string,
  environmentId: string,
  subscribeToNickname: string
) => {
  try {
    const team = await getTeam(teamId);
    if (!team) throw new Error("Team not found.");
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

    // if the team has never purchased a plan then we just create a new session and store their stripe customer id
    if (isNewTeam) {
      const customer = await stripe.customers.create({
        name: team.name,
        metadata: { team: teamId },
      });

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: lineItems,
        customer: customer.id,
        success_url: `${baseUrl}/billing-confirmation?environmentId=${environmentId}`,
        cancel_url: `${baseUrl}/environments/${environmentId}/settings/billing`,
        allow_promotion_codes: true,
        subscription_data: {
          billing_cycle_anchor: getFirstOfNextMonthTimestamp(),
          metadata: { teamId },
        },
      });

      await updateTeam(teamId, {
        billing: {
          ...team.billing,
          stripeCustomerId: customer.id,
        },
      });

      return { status: 200, data: "Your Plan has been upgraded!", newPlan: true, url: session.url };
    }

    const existingSubscription = (
      (await stripe.customers.retrieve(team.billing.stripeCustomerId as string, {
        expand: ["subscriptions"],
      })) as any
    ).subscriptions.data[0] as Stripe.Subscription;

    // the team has an active subscription
    if (existingSubscription) {
      // now we see if the team's current subscription is scheduled to cancel at the month end
      // this is a case where the team cancelled an already puchased product
      if (existingSubscription.cancel_at_period_end) {
        const allScheduledSubscriptions = await stripe.subscriptionSchedules.list({
          customer: team.billing.stripeCustomerId as string,
        });
        const scheduledSubscriptions = allScheduledSubscriptions.data.filter(
          (scheduledSub) => scheduledSub.status === "not_started"
        );

        // if a team has a scheduled subscritpion upcoming, then we update that as well with their
        // newly purchased product since the current one is ending this month end
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
          // if they do not have an upcoming new subscription schedule,
          // we create one since the current one with other products is expiring
          // so the new schedule only has the new product the team has subscribed to
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

      // the below check is to make sure that if a product is about to be cancelled but is still a part
      // of the current subscription then we do not update its status back to active
      if (
        !(
          existingSubscription.cancel_at_period_end &&
          team.billing.features[subscribeToNickname as keyof typeof team.billing.features].status ===
            "cancelled"
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
      // case where team does not have a subscription but has a stripe customer id
      // so we just attach that to a new subscription
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
    return {
      status: 500,
      data: "Something went wrong!",
      newPlan: true,
      url: `${baseUrl}/environments/${environmentId}/settings/billing`,
    };
  }
};
