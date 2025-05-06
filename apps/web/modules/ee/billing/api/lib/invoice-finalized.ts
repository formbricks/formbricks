import { STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";
import { getOrganization, updateOrganization } from "@/lib/organization/service";
import Stripe from "stripe";

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: STRIPE_API_VERSION,
});

export const handleInvoiceFinalized = async (event: Stripe.Event) => {
  const invoice = event.data.object as Stripe.Invoice;

  const customerId = invoice.customer as string;
  if (!customerId) {
    throw new Error("No customerId found in invoice");
  }

  // get the customer from stripe
  const customer = await stripe.customers.retrieve(customerId);

  if (!customer) {
    throw new Error("Customer not found");
  }

  if (customer.deleted) {
    throw new Error("Customer is deleted");
  }

  if (!customer.metadata) {
    throw new Error("No metadata found in customer");
  }
  if (!customer.metadata.organizationId) {
    throw new Error("No organizationId found in customer");
  }
  const organizationId = customer.metadata.organizationId;

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
