import Stripe from "stripe";

import { STRIPE_API_VERSION, WEBAPP_URL } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { getOrganization, updateOrganization } from "@formbricks/lib/organization/service";

import { StripePriceLookupKeys } from "./constants";
import { getFirstOfNextMonthTimestamp } from "./createSubscription";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

const baseUrl = process.env.NODE_ENV === "production" ? WEBAPP_URL : "http://localhost:3000";

const retrievePriceLookup = async (priceId: string) => (await stripe.prices.retrieve(priceId)).lookup_key;

export const removeSubscription = async (
  organizationId: string,
  environmentId: string,
  priceLookupKeys: StripePriceLookupKeys[]
) => {
  try {
    const organization = await getOrganization(organizationId);
    if (!organization) throw new Error("Organization not found.");
    if (!organization.billing.stripeCustomerId) {
      return { status: 400, data: "No subscription exists for given organization!", newPlan: false, url: "" };
    }

    const existingCustomer = (await stripe.customers.retrieve(organization.billing.stripeCustomerId, {
      expand: ["subscriptions"],
    })) as Stripe.Customer;
    const existingSubscription = existingCustomer.subscriptions?.data[0] as Stripe.Subscription;

    const allScheduledSubscriptions = await stripe.subscriptionSchedules.list({
      customer: organization.billing.stripeCustomerId,
    });
    const scheduledSubscriptions = allScheduledSubscriptions.data.filter(
      (scheduledSub) => scheduledSub.status === "not_started"
    );
    const newPriceIds: string[] = [];

    if (scheduledSubscriptions.length) {
      const priceIds = scheduledSubscriptions[0].phases[0].items.map((item) => item.price);
      for (const priceId of priceIds) {
        const priceLookUpKey = await retrievePriceLookup(priceId as string);
        if (!priceLookUpKey) continue;
        if (!priceLookupKeys.includes(priceLookUpKey as StripePriceLookupKeys)) {
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
              metadata: { organizationId },
            },
          ],
          metadata: { organizationId },
        });
      }
    } else {
      const validSubItems = existingSubscription.items.data.filter(
        (subItem) =>
          subItem.price.lookup_key &&
          !priceLookupKeys.includes(subItem.price.lookup_key as StripePriceLookupKeys)
      );
      newPriceIds.push(...validSubItems.map((subItem) => subItem.price.id));

      if (newPriceIds.length) {
        await stripe.subscriptionSchedules.create({
          customer: organization.billing.stripeCustomerId,
          start_date: getFirstOfNextMonthTimestamp(),
          end_behavior: "release",
          phases: [
            {
              items: newPriceIds.map((priceId) => ({ price: priceId })),
              iterations: 1,
              metadata: { organizationId },
            },
          ],
          metadata: { organizationId },
        });
      }
    }

    await stripe.subscriptions.update(existingSubscription.id, { cancel_at_period_end: true });

    let updatedFeatures = organization.billing.features;
    for (const priceLookupKey of priceLookupKeys) {
      updatedFeatures[priceLookupKey as keyof typeof updatedFeatures].status = "cancelled";
    }

    await updateOrganization(organizationId, {
      billing: {
        ...organization.billing,
        features: updatedFeatures,
      },
    });

    return {
      status: 200,
      data: "Successfully removed from your existing subscription!",
      newPlan: false,
      url: "",
    };
  } catch (err) {
    console.error(`Error in removing subscription: ${err}`);

    return {
      status: 500,
      data: "Something went wrong!",
      newPlan: true,
      url: `${baseUrl}/environments/${environmentId}/settings/billing`,
    };
  }
};
