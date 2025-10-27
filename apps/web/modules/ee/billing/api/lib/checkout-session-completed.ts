import Stripe from "stripe";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { BILLING_LIMITS, PROJECT_FEATURE_KEYS, STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";
import { getOrganization, updateOrganization } from "@/lib/organization/service";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

export const handleCheckoutSessionCompleted = async (event: Stripe.Event) => {
  const checkoutSession = event.data.object as Stripe.Checkout.Session;
  if (!checkoutSession.metadata?.organizationId)
    throw new ResourceNotFoundError("No organizationId found in checkout session", checkoutSession.id);

  const organization = await getOrganization(checkoutSession.metadata.organizationId);
  if (!organization)
    throw new ResourceNotFoundError("Organization not found", checkoutSession.metadata.organizationId);

  const subscription = await stripe.subscriptions.retrieve(checkoutSession.subscription as string, {
    expand: ["items.data.price"],
  });

  let period: "monthly" | "yearly" = "monthly";

  if (subscription.items?.data && subscription.items.data.length > 0) {
    const firstItem = subscription.items.data[0];
    const interval = firstItem.price?.recurring?.interval;
    period = interval === "year" ? "yearly" : "monthly";
  }

  await updateOrganization(checkoutSession.metadata.organizationId, {
    billing: {
      ...organization.billing,
      stripeCustomerId: checkoutSession.customer as string,
      plan: PROJECT_FEATURE_KEYS.STARTUP,
      period,
      limits: {
        projects: BILLING_LIMITS.STARTUP.PROJECTS,
        monthly: {
          responses: BILLING_LIMITS.STARTUP.RESPONSES,
          miu: BILLING_LIMITS.STARTUP.MIU,
        },
      },
      periodStart: new Date(),
    },
  });

  logger.info(
    {
      organizationId: checkoutSession.metadata.organizationId,
      plan: PROJECT_FEATURE_KEYS.STARTUP,
      period,
      checkoutSessionId: checkoutSession.id,
    },
    "Subscription activated"
  );

  const stripeCustomer = await stripe.customers.retrieve(checkoutSession.customer as string);
  if (stripeCustomer && !stripeCustomer.deleted) {
    await stripe.customers.update(stripeCustomer.id, {
      name: organization.name,
      metadata: { organizationId: organization.id },
    });
  }
};
