"use server";

import { createCustomerPortalSession } from "@/app/(ee)/(billing)/api/billing/stripe-webhook/lib/createCustomerPortalSession";
import { createSubscription } from "@/app/(ee)/(billing)/api/billing/stripe-webhook/lib/createSubscription";
import { isSubscriptionCancelled } from "@/app/(ee)/(billing)/api/billing/stripe-webhook/lib/isSubscriptionCancelled";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client-middleware";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { z } from "zod";
import { STRIPE_PRICE_LOOKUP_KEYS } from "@formbricks/lib/constants";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getOrganization } from "@formbricks/lib/organization/service";
import { ZId } from "@formbricks/types/common";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";

const ZUpgradePlanAction = z.object({
  environmentId: ZId,
  priceLookupKey: z.nativeEnum(STRIPE_PRICE_LOOKUP_KEYS),
});

export const upgradePlanAction = authenticatedActionClient
  .schema(ZUpgradePlanAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);

    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager", "billing"],
        },
      ],
    });

    return await createSubscription(organizationId, parsedInput.environmentId, parsedInput.priceLookupKey);
  });

const ZManageSubscriptionAction = z.object({
  environmentId: ZId,
});

export const manageSubscriptionAction = authenticatedActionClient
  .schema(ZManageSubscriptionAction)
  .action(async ({ ctx, parsedInput }) => {
    const organizationId = await getOrganizationIdFromEnvironmentId(parsedInput.environmentId);
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager", "billing"],
        },
      ],
    });

    const organization = await getOrganization(organizationId);
    if (!organization) {
      throw new ResourceNotFoundError("organization", organizationId);
    }

    if (!organization.billing.stripeCustomerId) {
      throw new AuthorizationError("You do not have an associated Stripe CustomerId");
    }

    return await createCustomerPortalSession(
      organization.billing.stripeCustomerId,
      `${WEBAPP_URL}/environments/${parsedInput.environmentId}/settings/billing`
    );
  });

const ZIsSubscriptionCancelledAction = z.object({
  organizationId: ZId,
});

export const isSubscriptionCancelledAction = authenticatedActionClient
  .schema(ZIsSubscriptionCancelledAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager", "billing"],
        },
      ],
    });

    return await isSubscriptionCancelled(parsedInput.organizationId);
  });
