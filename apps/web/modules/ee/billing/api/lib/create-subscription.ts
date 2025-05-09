import { STRIPE_API_VERSION, WEBAPP_URL } from "@/lib/constants";
import { STRIPE_PRICE_LOOKUP_KEYS } from "@/lib/constants";
import { env } from "@/lib/env";
import { getOrganization } from "@/lib/organization/service";
import Stripe from "stripe";
import { logger } from "@formbricks/logger";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

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

    const checkoutSessionCreateParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      line_items: [
        {
          price: priceObject.id,
          quantity: 1,
        },
      ],
      success_url: `${WEBAPP_URL}/billing-confirmation?environmentId=${environmentId}`,
      cancel_url: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { organizationId },
        trial_period_days: 30,
      },
      metadata: { organizationId, responses, miu },
      billing_address_collection: "required",
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      payment_method_data: { allow_redisplay: "always" },
      ...(!isNewOrganization && {
        customer: organization.billing.stripeCustomerId ?? undefined,
        customer_update: {
          name: "auto",
        },
      }),
    };

    // if the organization has never purchased a plan then we just create a new session and store their stripe customer id
    if (isNewOrganization) {
      const session = await stripe.checkout.sessions.create(checkoutSessionCreateParams);

      return { status: 200, data: "Your Plan has been upgraded!", newPlan: true, url: session.url };
    }

    const existingSubscription = await stripe.subscriptions.list({
      customer: organization.billing.stripeCustomerId as string,
    });

    if (existingSubscription.data?.length > 0) {
      const existingSubscriptionItem = existingSubscription.data[0].items.data[0];

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
    } else {
      // Create a new checkout again if there is no active subscription
      const session = await stripe.checkout.sessions.create(checkoutSessionCreateParams);

      return { status: 200, data: "Your Plan has been upgraded!", newPlan: true, url: session.url };
    }

    return {
      status: 200,
      data: "Congrats! Added to your existing subscription!",
      newPlan: false,
      url: "",
    };
  } catch (err) {
    logger.error(err, "Error creating subscription");
    return {
      status: 500,
      newPlan: true,
      url: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
    };
  }
};
