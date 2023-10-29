import { getTeam, updateTeam } from "@formbricks/lib/team/service";
import { getFirstOfNextMonthTimestamp } from "./create-subscription";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const retrievePriceLookup = async (priceId: string) => (await stripe.prices.retrieve(priceId)).lookup_key;

export const removeSubscription = async (teamId: string, failureUrl: string, itemToBeRemoved: string) => {
  try {
    const team = await getTeam(teamId);
    if (!team) throw new Error("Team not found.");
    if (!team.billing.stripeCustomerId) {
      return { status: 400, data: "No subscription exists for given team!", newPlan: false, url: "" };
    }

    const existingCustomer = (await stripe.customers.retrieve(team.billing.stripeCustomerId, {
      expand: ["subscriptions"],
    })) as Stripe.Customer;
    const existingSubscription = existingCustomer.subscriptions?.data[0] as Stripe.Subscription;

    const allScheduledSubscriptions = await stripe.subscriptionSchedules.list({
      customer: team.billing.stripeCustomerId,
    });
    const scheduledSubscriptions = allScheduledSubscriptions.data.filter(
      (scheduledSub) => scheduledSub.status === "not_started"
    );
    const newPriceIds: string[] = [];

    if (scheduledSubscriptions.length) {
      const priceIds = scheduledSubscriptions[0].phases[0].items.map((item) => item.price);
      for (const priceId of priceIds) {
        if ((await retrievePriceLookup(priceId as string)) !== itemToBeRemoved) {
          newPriceIds.push(priceId as string);
        }
      }

      if (!newPriceIds.length) {
        await stripe.subscriptionSchedules.cancel(scheduledSubscriptions[0].id);
      } else {
        await stripe.subscriptionSchedules.update(scheduledSubscriptions[0].id, {
          end_behavior: "release",
          phases: [
            {
              start_date: getFirstOfNextMonthTimestamp(),
              items: newPriceIds.map((priceId) => ({ price: priceId })),
              iterations: 1,
              metadata: { teamId },
            },
          ],
          metadata: { teamId },
        });
      }
    } else {
      const validSubItems = existingSubscription.items.data.filter(
        (subItem) => subItem.price.lookup_key !== itemToBeRemoved
      );
      newPriceIds.push(...validSubItems.map((subItem) => subItem.price.id));

      if (newPriceIds.length) {
        await stripe.subscriptionSchedules.create({
          customer: team.billing.stripeCustomerId,
          start_date: getFirstOfNextMonthTimestamp(),
          end_behavior: "release",
          phases: [
            {
              items: newPriceIds.map((priceId) => ({ price: priceId })),
              iterations: 1,
              metadata: { teamId },
            },
          ],
          metadata: { teamId },
        });
      }
    }

    await stripe.subscriptions.update(existingSubscription.id, { cancel_at_period_end: true });

    await updateTeam(teamId, {
      billing: {
        ...team.billing,
        features: {
          ...team.billing.features,
          [itemToBeRemoved]: { status: "cancelled" },
        },
      },
    });

    return {
      status: 200,
      data: "Successfully removed from your existing subscription!",
      newPlan: false,
      url: "",
    };
  } catch (err) {
    console.log(err);

    return { status: 500, data: "Something went wrong!", newPlan: true, url: failureUrl };
  }
};
