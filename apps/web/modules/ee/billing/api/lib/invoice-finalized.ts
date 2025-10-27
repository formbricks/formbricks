import Stripe from "stripe";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { STRIPE_API_VERSION } from "@/lib/constants";
import { env } from "@/lib/env";
import { getOrganization, updateOrganization } from "@/lib/organization/service";

export const handleInvoiceFinalized = async (event: Stripe.Event) => {
  const invoice = event.data.object as Stripe.Invoice;

  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) {
    logger.warn({ invoiceId: invoice.id }, "Invoice finalized without subscription ID");
    return { status: 400, message: "No subscription ID found in invoice" };
  }

  try {
    const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
      apiVersion: STRIPE_API_VERSION,
    });

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const organizationId = subscription.metadata?.organizationId;

    if (!organizationId) {
      logger.warn(
        {
          subscriptionId,
          invoiceId: invoice.id,
        },
        "No organizationId found in subscription metadata"
      );
      return { status: 400, message: "No organizationId found in subscription" };
    }

    const organization = await getOrganization(organizationId);
    if (!organization) {
      throw new ResourceNotFoundError("Organization not found", organizationId);
    }

    const periodStartTimestamp = invoice.lines.data[0]?.period?.start;
    const periodStart = periodStartTimestamp ? new Date(periodStartTimestamp * 1000) : new Date();

    await updateOrganization(organizationId, {
      billing: {
        ...organization.billing,
        periodStart,
      },
    });

    logger.info(
      {
        organizationId,
        periodStart,
        invoiceId: invoice.id,
      },
      "Billing period updated successfully"
    );

    return { status: 200, message: "Billing period updated successfully" };
  } catch (error) {
    logger.error(error, "Error updating billing period", {
      invoiceId: invoice.id,
      subscriptionId,
    });
    return { status: 500, message: "Error updating billing period" };
  }
};
