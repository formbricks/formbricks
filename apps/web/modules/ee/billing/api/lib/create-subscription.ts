import Stripe from "stripe";
import { logger } from "@formbricks/logger";
import { STRIPE_API_VERSION, WEBAPP_URL } from "@/lib/constants";
import { env } from "@/lib/env";
import { getOrganization } from "@/lib/organization/service";
import { ensureStripeCustomerForOrganization } from "@/modules/billing/lib/organization-billing";
import {
  CLOUD_STRIPE_PRICE_LOOKUP_KEYS,
  CLOUD_STRIPE_PRODUCT_IDS,
  TCloudUpgradePriceLookupKey,
  getCloudPlanFromProductId,
} from "@/modules/billing/lib/stripe-catalog";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

export const createSubscription = async (
  organizationId: string,
  environmentId: string,
  priceLookupKey: TCloudUpgradePriceLookupKey
) => {
  try {
    const organization = await getOrganization(organizationId);
    if (!organization) throw new Error("Organization not found.");

    const { customerId } = await ensureStripeCustomerForOrganization(organizationId);
    if (!customerId) throw new Error("Stripe customer unavailable");

    const existingSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
      expand: ["data.items.data.price.product"],
    });

    const hasPaidSubscriptionHistory = existingSubscriptions.data.some((subscription) =>
      subscription.items.data.some((item) => {
        const product = item.price.product;
        const productId = typeof product === "string" ? product : product.id;

        // "unknown" products are treated as paid history to avoid repeated free trials.
        const plan = getCloudPlanFromProductId(productId);
        return plan !== "hobby" && productId !== CLOUD_STRIPE_PRODUCT_IDS.HOBBY;
      })
    );

    const lookupKeys: string[] = [priceLookupKey];

    if (
      priceLookupKey === CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_MONTHLY ||
      priceLookupKey === CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_YEARLY
    ) {
      lookupKeys.push(CLOUD_STRIPE_PRICE_LOOKUP_KEYS.PRO_USAGE_RESPONSES);
    }

    if (
      priceLookupKey === CLOUD_STRIPE_PRICE_LOOKUP_KEYS.SCALE_MONTHLY ||
      priceLookupKey === CLOUD_STRIPE_PRICE_LOOKUP_KEYS.SCALE_YEARLY
    ) {
      lookupKeys.push(CLOUD_STRIPE_PRICE_LOOKUP_KEYS.SCALE_USAGE_RESPONSES);
    }

    const prices = await stripe.prices.list({
      lookup_keys: lookupKeys,
      limit: 100,
    });

    if (prices.data.length !== lookupKeys.length) {
      throw new Error(`One or more prices not found in Stripe for ${lookupKeys.join(", ")}`);
    }

    const getPriceByLookupKey = (lookupKey: string) => {
      const price = prices.data.find((entry) => entry.lookup_key === lookupKey);
      if (!price) throw new Error(`Price ${lookupKey} not found`);
      return price;
    };

    const lineItems = lookupKeys.map((lookupKey) => {
      const price = getPriceByLookupKey(lookupKey);

      if (price.recurring?.usage_type === "metered") {
        return { price: price.id };
      }

      return { price: price.id, quantity: 1 };
    });

    // Always create a checkout session - let Stripe handle existing customers
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: lineItems,
      success_url: `${WEBAPP_URL}/billing-confirmation?environmentId=${environmentId}`,
      cancel_url: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
      customer: customerId,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { organizationId },
        ...(hasPaidSubscriptionHistory ? {} : { trial_period_days: 14 }),
      },
      metadata: { organizationId },
      billing_address_collection: "required",
      customer_update: {
        address: "auto",
        name: "auto",
      },
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      payment_method_data: { allow_redisplay: "always" },
    });

    return { status: 200, data: "Your Plan has been upgraded!", newPlan: true, url: session.url };
  } catch (err) {
    logger.error(err, "Error creating subscription");
    return {
      status: 500,
      newPlan: false,
      url: `${WEBAPP_URL}/environments/${environmentId}/settings/billing`,
    };
  }
};
