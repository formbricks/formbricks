import Stripe from "stripe";
import { logger } from "@formbricks/logger";
import { STRIPE_API_VERSION, STRIPE_PRICE_LOOKUP_KEYS, WEBAPP_URL } from "@/lib/constants";
import { env } from "@/lib/env";
import { getOrganization } from "@/lib/organization/service";

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

    const priceObject = (
      await stripe.prices.list({
        lookup_keys: [priceLookupKey],
      })
    ).data[0];

    if (!priceObject) throw new Error("Price not found");

    // Always create a checkout session - let Stripe handle existing customers
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price: priceObject.id,
          quantity: 1,
        },
      ],
      success_url: `${WEBAPP_URL}/billing-confirmation?environmentId=${environmentId}`,
      cancel_url: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
      customer: organization.billing.stripeCustomerId ?? undefined,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { organizationId },
        trial_period_days: 15,
      },
      metadata: { organizationId },
      billing_address_collection: "required",
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      payment_method_data: { allow_redisplay: "always" },
    });

    return { status: 200, data: "Your Plan has been upgraded!", newPlan: true, url: session.url };
  } catch (err) {
    logger.error(err, "Error creating subscription");
    return {
      status: 500,
      newPlan: true,
      url: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
    };
  }
};
