import { STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";
import { getOrganization, updateOrganization } from "@/lib/organization/service";
import Stripe from "stripe";
import { logger } from "@formbricks/logger";

export const handleInvoiceFinalized = async (event: Stripe.Event) => {
  const invoice = event.data.object as Stripe.Invoice;

  if (!invoice.customer) {
    logger.error("No customerId found in invoice object.");
    return { status: 400, message: "No customerId found in invoice" };
  }
  const customerId = invoice.customer as string;

  const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
    apiVersion: STRIPE_API_VERSION,
  });

  try {
    const customer = await stripe.customers.retrieve(customerId);

    if (!customer || customer.deleted) {
      logger.error(`Customer not found or deleted for customerId: ${customerId}`);
      return { status: 404, message: "Customer not found or deleted" };
    }

    const organizationId = customer.metadata?.organizationId;
    if (!organizationId) {
      logger.error(`OrganizationId not found in customer metadata for customerId: ${customerId}`);
      return { status: 400, message: "No organizationId found in customer metadata" };
    }

    const organization = await getOrganization(organizationId);
    if (!organization) {
      logger.error(`Organization not found for organizationId: ${organizationId}`);
      return { status: 404, message: "Organization not found" };
    }

    const firstLineItem = invoice.lines?.data?.[0];
    if (!firstLineItem) {
      logger.error(`No line items found in invoice: ${invoice.id}`);
      return { status: 400, message: "No line items found in invoice" };
    }

    const periodStartTimestamp = firstLineItem.period?.start;
    const periodStart = periodStartTimestamp ? new Date(periodStartTimestamp * 1000) : new Date();

    await updateOrganization(organizationId, {
      billing: {
        ...organization.billing,
        stripeCustomerId: customerId,
        periodStart,
      },
    });

    return { status: 200, message: "success" };
  } catch (error: any) {
    logger.error(
      error,
      `Error processing invoice.finalized event for invoiceId ${invoice.id}: ${error.message}`
    );
    return { status: 500, message: `Internal server error: ${error.message}` };
  }
};
