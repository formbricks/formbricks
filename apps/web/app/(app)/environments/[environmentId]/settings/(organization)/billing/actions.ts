"use server";

import { z } from "zod";
import { createCustomerPortalSession } from "@formbricks/ee/billing/lib/create-customer-portal-session";
import { createSubscription } from "@formbricks/ee/billing/lib/create-subscription";
import { isSubscriptionCancelled } from "@formbricks/ee/billing/lib/is-subscription-cancelled";
import { authenticatedActionClient } from "@formbricks/lib/actionClient";
import { checkAuthorization } from "@formbricks/lib/actionClient/utils";
import { STRIPE_PRICE_LOOKUP_KEYS } from "@formbricks/lib/constants";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getOrganization } from "@formbricks/lib/organization/service";
import { ZId } from "@formbricks/types/common";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";

const ZUpgradePlanAction = z.object({
  organizationId: ZId,
  environmentId: ZId,
  priceLookupKey: z.nativeEnum(STRIPE_PRICE_LOOKUP_KEYS),
});

export const upgradePlanAction = authenticatedActionClient
  .schema(ZUpgradePlanAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      rules: ["subscription", "create"],
    });
    const organization = await getOrganization(parsedInput.organizationId);
    if (!organization) {
      throw new ResourceNotFoundError("organization", parsedInput.organizationId);
    }

    return await createSubscription(
      parsedInput.organizationId,
      parsedInput.environmentId,
      parsedInput.priceLookupKey
    );
  });

const ZManageSubscriptionAction = z.object({
  organizationId: ZId,
  environmentId: ZId,
});

export const manageSubscriptionAction = authenticatedActionClient
  .schema(ZManageSubscriptionAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      rules: ["subscription", "read"],
    });
    const organization = await getOrganization(parsedInput.organizationId);
    if (!organization) {
      throw new ResourceNotFoundError("organization", parsedInput.organizationId);
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
    await checkAuthorization({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      rules: ["subscription", "read"],
    });

    return await isSubscriptionCancelled(parsedInput.organizationId);
  });
