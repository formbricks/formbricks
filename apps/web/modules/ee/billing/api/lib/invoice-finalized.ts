import Stripe from "stripe";
import { getOrganization, updateOrganization } from "@formbricks/lib/organization/service";

export const handleInvoiceFinalized = async (event: Stripe.Event) => {
  const invoice = event.data.object as Stripe.Invoice;

  const stripeSubscriptionDetails = invoice.subscription_details;
  const organizationId = stripeSubscriptionDetails?.metadata?.organizationId;

  if (!organizationId) {
    throw new Error("No organizationId found in subscription");
  }

  const organization = await getOrganization(organizationId);
  if (!organization) {
    throw new Error("Organization not found");
  }

  const periodStartTimestamp = invoice.lines.data[0].period.start;
  const periodStart = periodStartTimestamp ? new Date(periodStartTimestamp * 1000) : new Date();

  await updateOrganization(organizationId, {
    ...organization,
    billing: {
      ...organization.billing,
      stripeCustomerId: invoice.customer as string,
      periodStart,
    },
  });

  return { status: 200, message: "success" };
};
