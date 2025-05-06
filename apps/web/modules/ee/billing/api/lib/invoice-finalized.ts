import { getOrganization, updateOrganization } from "@/lib/organization/service";
import Stripe from "stripe";
import { logger } from "@formbricks/logger";

export const handleInvoiceFinalized = async (event: Stripe.Event) => {
  const invoice = event.data.object as Stripe.Invoice;

  if (!invoice.customer) {
    logger.error("No customerId found in invoice object.");
    return { status: 400, message: "No customerId found in invoice" };
  }
  const stripeSubscriptionDetails = invoice.subscription_details;
  const organizationId = stripeSubscriptionDetails?.metadata?.organizationId;

  if (!organizationId) {
    logger.error("No organizationId found in customer metadata.");
    return { status: 400, message: "No organizationId found in customer metadata" };
  }

  try {
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
        stripeCustomerId: invoice.customer as string,
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
