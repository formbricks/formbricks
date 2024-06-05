import Stripe from "stripe";

import { STRIPE_API_VERSION } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { getOrganization, updateOrganization } from "@formbricks/lib/organization/service";
import { ResourceNotFoundError } from "@formbricks/types/errors";

import { PRODUCT_FEATURE_KEYS, STRIPE_PRODUCT_NAMES } from "../lib/constants";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: STRIPE_API_VERSION,
});

export const handleSubscriptionCreatedOrUpdated = async (event: Stripe.Event) => {
  const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
  const organizationId = stripeSubscriptionObject.metadata.organizationId;

  if (stripeSubscriptionObject.status !== "active" || stripeSubscriptionObject.cancel_at_period_end) {
    return;
  }

  if (!organizationId) {
    console.error("No organizationId found in subscription");
    return { status: 400, message: "skipping, no organizationId found" };
  }

  const organization = await getOrganization(organizationId);
  if (!organization) throw new ResourceNotFoundError("Organization not found", organizationId);

  const product = await stripe.products.retrieve(
    stripeSubscriptionObject.items.data[0].price.product as string
  );
  if (!product)
    throw new ResourceNotFoundError(
      "Product not found",
      stripeSubscriptionObject.items.data[0].price.product.toString()
    );

  let updatedBilling = organization.billing;
  let responses = parseInt(product.metadata.responses);
  let miu = parseInt(product.metadata.miu);

  if (!responses || !miu) {
    // Enteprise Plan Payment via Payment Link
    responses = parseInt(stripeSubscriptionObject.metadata.responses);
    miu = parseInt(stripeSubscriptionObject.metadata.miu);
  }

  updatedBilling.limits.monthly = { responses, miu };

  switch (product.name) {
    case STRIPE_PRODUCT_NAMES.STARTUP:
      updatedBilling.plan = PRODUCT_FEATURE_KEYS.STARTUP;
      break;

    case STRIPE_PRODUCT_NAMES.SCALE:
      updatedBilling.plan = PRODUCT_FEATURE_KEYS.SCALE;
      break;

    case STRIPE_PRODUCT_NAMES.ENTERPRISE:
      updatedBilling.plan = PRODUCT_FEATURE_KEYS.ENTERPRISE;
      break;
  }

  await updateOrganization(organizationId, {
    billing: {
      stripeCustomerId: stripeSubscriptionObject.customer as string,
      plan: updatedBilling.plan,
      limits: updatedBilling.limits,
    },
  });

  await stripe.customers.update(stripeSubscriptionObject.customer as string, {
    name: organization.name,
    metadata: { orgnizationId: organization.id },
    invoice_settings: {
      default_payment_method: stripeSubscriptionObject.default_payment_method as string,
    },
  });
};
