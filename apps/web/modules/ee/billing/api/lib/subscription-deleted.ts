import Stripe from "stripe";
import { BILLING_LIMITS, PROJECT_FEATURE_KEYS } from "@formbricks/lib/constants";
import { getOrganization, updateOrganization } from "@formbricks/lib/organization/service";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";

export const handleSubscriptionDeleted = async (event: Stripe.Event) => {
  const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
  const organizationId = stripeSubscriptionObject.metadata.organizationId;
  if (!organizationId) {
    logger.warn({ event, organizationId }, "No organizationId found in subscription");
    return { status: 400, message: "skipping, no organizationId found" };
  }

  const organization = await getOrganization(organizationId);
  if (!organization) throw new ResourceNotFoundError("Organization not found", organizationId);

  await updateOrganization(organizationId, {
    billing: {
      ...organization.billing,
      plan: PROJECT_FEATURE_KEYS.FREE,
      limits: {
        projects: BILLING_LIMITS.FREE.PROJECTS,
        monthly: {
          responses: BILLING_LIMITS.FREE.RESPONSES,
          miu: BILLING_LIMITS.FREE.MIU,
        },
      },
      periodStart: new Date(),
      period: "monthly",
    },
  });
};
