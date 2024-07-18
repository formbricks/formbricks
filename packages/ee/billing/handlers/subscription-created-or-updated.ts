import Stripe from "stripe";
import { PRODUCT_FEATURE_KEYS, STRIPE_API_VERSION } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { getOrganization, updateOrganization } from "@formbricks/lib/organization/service";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import {
  TOrganizationBillingPeriod,
  TOrganizationBillingPlan,
  ZOrganizationBillingPeriod,
  ZOrganizationBillingPlan,
} from "@formbricks/types/organizations";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: STRIPE_API_VERSION,
});

export const handleSubscriptionCreatedOrUpdated = async (event: Stripe.Event) => {
  const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
  const organizationId = stripeSubscriptionObject.metadata.organizationId;

  if (
    !["active", "trialing"].includes(stripeSubscriptionObject.status) ||
    stripeSubscriptionObject.cancel_at_period_end
  ) {
    return;
  }

  if (!organizationId) {
    console.error("No organizationId found in subscription");
    return { status: 400, message: "skipping, no organizationId found" };
  }

  const organization = await getOrganization(organizationId);
  if (!organization) throw new ResourceNotFoundError("Organization not found", organizationId);

  const subscriptionPrice = stripeSubscriptionObject.items.data[0].price;
  const product = await stripe.products.retrieve(subscriptionPrice.product as string);

  if (!product)
    throw new ResourceNotFoundError(
      "Product not found",
      stripeSubscriptionObject.items.data[0].price.product.toString()
    );

  let period: TOrganizationBillingPeriod = "monthly";
  const periodParsed = ZOrganizationBillingPeriod.safeParse(subscriptionPrice.metadata.period);
  if (periodParsed.success) {
    period = periodParsed.data;
  }

  let updatedBillingPlan: TOrganizationBillingPlan = organization.billing.plan;

  let responses: number | null = null;
  let miu: number | null = null;

  if (product.metadata.responses === "unlimited") {
    responses = null;
  } else if (parseInt(product.metadata.responses) > 0) {
    responses = parseInt(product.metadata.responses);
  } else {
    console.error("Invalid responses metadata in product: ", product.metadata.responses);
    throw new Error("Invalid responses metadata in product");
  }

  if (product.metadata.miu === "unlimited") {
    miu = null;
  } else if (parseInt(product.metadata.miu) > 0) {
    miu = parseInt(product.metadata.miu);
  } else {
    console.error("Invalid miu metadata in product: ", product.metadata.miu);
    throw new Error("Invalid miu metadata in product");
  }

  const plan = ZOrganizationBillingPlan.parse(product.metadata.plan);

  switch (plan) {
    case PRODUCT_FEATURE_KEYS.FREE:
      updatedBillingPlan = PRODUCT_FEATURE_KEYS.STARTUP;
      break;

    case PRODUCT_FEATURE_KEYS.STARTUP:
      updatedBillingPlan = PRODUCT_FEATURE_KEYS.STARTUP;
      break;

    case PRODUCT_FEATURE_KEYS.SCALE:
      updatedBillingPlan = PRODUCT_FEATURE_KEYS.SCALE;
      break;

    case PRODUCT_FEATURE_KEYS.ENTERPRISE:
      updatedBillingPlan = PRODUCT_FEATURE_KEYS.ENTERPRISE;
      break;
  }

  await updateOrganization(organizationId, {
    billing: {
      ...organization.billing,
      stripeCustomerId: stripeSubscriptionObject.customer as string,
      plan: updatedBillingPlan,
      period,
      limits: {
        monthly: {
          responses,
          miu,
        },
      },
    },
  });

  await stripe.customers.update(stripeSubscriptionObject.customer as string, {
    name: organization.name,
    metadata: { organizationId: organization.id },
    invoice_settings: {
      default_payment_method: stripeSubscriptionObject.default_payment_method as string,
    },
  });
};
