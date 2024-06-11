import Stripe from "stripe";
import { STRIPE_API_VERSION, WEBAPP_URL } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { getOrganization } from "@formbricks/lib/organization/service";
import { STRIPE_PRICE_LOOKUP_KEYS } from "./constants";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

const baseUrl = process.env.NODE_ENV === "production" ? WEBAPP_URL : "http://localhost:3000";

export const getFirstOfNextMonthTimestamp = (): number => {
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
  return Math.floor(nextMonth.getTime() / 1000);
};

export const createSubscription = async (
  organizationId: string,
  environmentId: string,
  priceLookupKey: STRIPE_PRICE_LOOKUP_KEYS
) => {
  try {
    const organization = await getOrganization(organizationId);
    if (!organization) throw new Error("Organization not found.");
    let isNewOrganization =
      !organization.billing.stripeCustomerId ||
      !(await stripe.customers.retrieve(organization.billing.stripeCustomerId));

    const priceObject = (
      await stripe.prices.list({
        lookup_keys: [priceLookupKey],
        expand: ["data.product"],
      })
    ).data[0];

    if (!priceObject) throw new Error("Price not found");
    const responses = parseInt((priceObject.product as Stripe.Product).metadata.responses);
    const miu = parseInt((priceObject.product as Stripe.Product).metadata.miu);

    // if the organization has never purchased a plan then we just create a new session and store their stripe customer id
    if (isNewOrganization) {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [
          {
            price: priceObject.id,
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/billing-confirmation?environmentId=${environmentId}`,
        cancel_url: `${baseUrl}/environments/${environmentId}/settings/billing`,
        allow_promotion_codes: true,
        subscription_data: {
          billing_cycle_anchor: getFirstOfNextMonthTimestamp(),
          metadata: { organizationId },
        },
        metadata: { organizationId, responses, miu },
        automatic_tax: { enabled: true },
      });

      return { status: 200, data: "Your Plan has been upgraded!", newPlan: true, url: session.url };
    }

    const existingSubscription = await stripe.subscriptions.list({
      customer: organization.billing.stripeCustomerId as string,
      status: "all",
    });

    const activeSubscription = existingSubscription.data.find(
      (subscription) => subscription.status === "active"
    );

    if (activeSubscription) {
      const existingSubscriptionItem = activeSubscription.items.data[0];

      await stripe.subscriptions.update(existingSubscription.data[0].id, {
        items: [
          {
            id: existingSubscriptionItem.id,
            deleted: true,
          },
          {
            price: priceObject.id,
          },
        ],
        cancel_at_period_end: false,
      });

      return {
        status: 200,
        data: "Congrats! Added to your existing subscription!",
        newPlan: false,
        url: "",
      };
    }

    // Handle case when no active subscription is found
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceObject.id,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/billing-confirmation?environmentId=${environmentId}`,
      cancel_url: `${baseUrl}/environments/${environmentId}/settings/billing`,
      allow_promotion_codes: true,
      subscription_data: {
        billing_cycle_anchor: getFirstOfNextMonthTimestamp(),
        metadata: { organizationId },
      },
      metadata: { organizationId, responses, miu },
      automatic_tax: { enabled: true },
    });

    return { status: 200, data: "Your Plan has been upgraded!", newPlan: true, url: session.url };
  } catch (err) {
    console.error(err);
    return {
      status: 500,
      newPlan: true,
      url: `${baseUrl}/environments/${environmentId}/settings/billing`,
    };
  }
};
