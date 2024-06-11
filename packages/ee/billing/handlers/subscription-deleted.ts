import Stripe from "stripe";
import { getOrganization, updateOrganization } from "@formbricks/lib/organization/service";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { LIMITS, PRODUCT_FEATURE_KEYS } from "../lib/constants";

export const handleSubscriptionDeleted = async (event: Stripe.Event) => {
  const stripeSubscriptionObject = event.data.object as Stripe.Subscription;
  const organizationId = stripeSubscriptionObject.metadata.organizationId;
  if (!organizationId) {
    console.error("No organizationId found in subscription");
    return { status: 400, message: "skipping, no organizationId found" };
  }

  const organization = await getOrganization(organizationId);
  if (!organization) throw new ResourceNotFoundError("Organization not found", organizationId);

  await updateOrganization(organizationId, {
    billing: {
      ...organization.billing,
      plan: PRODUCT_FEATURE_KEYS.FREE,
      limits: {
        monthly: {
          responses: LIMITS.FREE.RESPONSES,
          miu: LIMITS.FREE.MIU,
        },
      },
    },
  });
};
