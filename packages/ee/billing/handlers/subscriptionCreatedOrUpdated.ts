import Stripe from "stripe";

import { STRIPE_API_VERSION } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { getOrganization, updateOrganization } from "@formbricks/lib/organization/service";

import { ProductFeatureKeys, StripeProductNames } from "../lib/constants";

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
  if (!organization) throw new Error("Team not found");

  const product = await stripe.products.retrieve(
    stripeSubscriptionObject.items.data[0].price.product as string
  );
  if (!product) throw new Error("Product not found");

  let updatedBilling = organization.billing;
  let responses = product.metadata.responses as unknown as number;
  let miu = product.metadata.miu as unknown as number;

  if (!responses || !miu) {
    // Enteprise Plan Payment via Payment Link
    responses = stripeSubscriptionObject.metadata.responses as unknown as number;
    miu = stripeSubscriptionObject.metadata.miu as unknown as number;
  }

  updatedBilling.limits.monthly = { responses, miu };

  switch (product.name) {
    case StripeProductNames.startup:
      updatedBilling.plan = ProductFeatureKeys.startup;
      break;

    case StripeProductNames.scale:
      updatedBilling.plan = ProductFeatureKeys.scale;
      break;

    case StripeProductNames.enterprise:
      updatedBilling.plan = ProductFeatureKeys.enterprise;
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
    metadata: { team: organization.id },
    invoice_settings: {
      default_payment_method: stripeSubscriptionObject.default_payment_method as string,
    },
  });
};
