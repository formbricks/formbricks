import Stripe from "stripe";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { BILLING_LIMITS, PROJECT_FEATURE_KEYS } from "@/lib/constants";
import { getOrganization, updateOrganization } from "@/lib/organization/service";
import { getPostHogClient } from "@/lib/posthog-server";

export const handleSubscriptionDeleted = async (event: Stripe.Event) => {
  const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
  const organizationId = stripeSubscriptionObject.metadata.organizationId;
  if (!organizationId) {
    logger.error({ event, organizationId }, "No organizationId found in subscription");
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

  logger.info(
    {
      organizationId,
      subscriptionId: stripeSubscriptionObject.id,
    },
    "Subscription cancelled - downgraded to FREE plan"
  );

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: organizationId,
    event: "subscription_cancelled",
    properties: {
      organization_id: organizationId,
      subscription_id: stripeSubscriptionObject.id,
      downgraded_to_plan: PROJECT_FEATURE_KEYS.FREE,
    },
  });
  await posthog.shutdown();
};
