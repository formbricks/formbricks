import Stripe from "stripe";
import { STRIPE_API_VERSION } from "@formbricks/lib/constants";
import { env } from "@formbricks/lib/env";
import { getOrganization, updateOrganization } from "@formbricks/lib/organization/service";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  // https://github.com/stripe/stripe-node#configuration
  apiVersion: STRIPE_API_VERSION,
});

export const handleInvoiceFinalized = async (event: Stripe.Event) => {
  const invoice = event.data.object as Stripe.Invoice;

  const stripeSubscriptionDetails = invoice.subscription_details;
  const organizationId = stripeSubscriptionDetails.metadata.organizationId;

  if (!organizationId) {
    throw new Error("No organizationId found in subscription");
  }

  const organization = await getOrganization(organizationId);
  if (!organization) {
    throw new Error("Organization not found");
  }

  await updateOrganization(organizationId, {
    ...organization,
    billing: {
      ...organization.billing,
      stripeCustomerId: invoice.customer as string,
      periodStart: new Date(invoice.period_start * 1000),
    },
  });

  return { status: 200, message: "success" };
};
