import { getTeam, updateTeam } from "@formbricks/lib/team/service";
import { getFirstOfNextMonthTimestamp } from "./create-subscription";
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: "2023-10-16",
});

const removeSubscription = async (teamId: string, failureUrl: string, itemToBeRemoved: string) => {
  try {
    console.log("inside remove ffs");
    const team = await getTeam(teamId);

    if (!team.billing.stripeCustomerId) {
      return { status: 400, data: "No subscription exists for given team!", newPlan: false, url: "" };
    }

    const existingCustomer = await stripe.customers.retrieve(team.billing.stripeCustomerId, {
      expand: ["subscriptions"],
    });
    const existingSubscription = existingCustomer.subscriptions.data[0] as Stripe.Subscription;

    const isThereAlreadyASubscriptionScheduled = await stripe.subscriptionSchedules.list({
      customer: team.billing.stripeCustomerId,
    });

    let newPriceIds: string[] = [];

    if (isThereAlreadyASubscriptionScheduled) {
      console.log(
        "isThereAlreadyASubscriptionScheduled",
        isThereAlreadyASubscriptionScheduled.data[0].phases[0].items
      );

      const priceIds = isThereAlreadyASubscriptionScheduled.data[0].phases[0].items.map((item) => item.price);

      for (const priceId of priceIds) {
        const priceLookupKey = (await stripe.prices.retrieve(priceId as string)).lookup_key;
        if (priceLookupKey !== itemToBeRemoved) {
          newPriceIds.push(priceId as string);
        }
      }
      console.log("existingsched newPriceIds", newPriceIds);

      if (newPriceIds.length === 0) {
        await stripe.subscriptionSchedules.cancel(isThereAlreadyASubscriptionScheduled.data[0].id);
      } else {
        await stripe.subscriptionSchedules.update(isThereAlreadyASubscriptionScheduled.data[0].id, {
          end_behavior: "release",
          phases: [
            {
              start_date: getFirstOfNextMonthTimestamp(),
              items: newPriceIds.map((priceId) => ({ price: priceId })),
              iterations: 1,
              metadata: {
                teamId,
              },
            },
          ],
        });
      }
    } else {
      for (const subItem of existingSubscription.items.data) {
        console.log(subItem.price.lookup_key, itemToBeRemoved);

        if (subItem.price.lookup_key !== itemToBeRemoved) {
          newPriceIds.push(subItem.price.id);
        }
      }

      console.log("newPriceIds", newPriceIds);

      await stripe.subscriptionSchedules.create({
        customer: team.billing.stripeCustomerId,
        start_date: getFirstOfNextMonthTimestamp(),
        end_behavior: "release",
        phases: [
          {
            items: newPriceIds.map((priceId) => ({ price: priceId })),
            iterations: 1,
          },
        ],
        // TODO: see if the below metadata also gets attached to the subscription (NEED IT TO)
        metadata: {
          teamId,
        },
      });
    }

    await stripe.subscriptions.update(existingSubscription.id, {
      cancel_at_period_end: true,
    });

    await updateTeam(teamId, {
      billing: {
        ...team.billing,
        features: {
          ...team.billing.features,
          [itemToBeRemoved]: {
            status: "cancelled",
          },
        },
      },
    });

    return {
      status: 200,
      data: "Succesfully removed from your existing subscription!",
      newPlan: false,
      url: "",
    };
  } catch (err) {
    console.log(err);

    return { status: 500, data: "Something went wrong!", newPlan: true, url: failureUrl };
  }
};

export default removeSubscription;
