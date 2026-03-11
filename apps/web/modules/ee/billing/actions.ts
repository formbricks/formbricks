"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { STRIPE_PRICE_LOOKUP_KEYS, WEBAPP_URL } from "@/lib/constants";
import { getOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { createCustomerPortalSession } from "@/modules/ee/billing/api/lib/create-customer-portal-session";
import { createSubscription } from "@/modules/ee/billing/api/lib/create-subscription";
import { isSubscriptionCancelled } from "@/modules/ee/billing/api/lib/is-subscription-cancelled";

const ZUpgradePlanAction = z.object({
  environmentId: ZId,
  priceLookupKey: z.enum(STRIPE_PRICE_LOOKUP_KEYS),
});

export const upgradePlanAction = authenticatedActionClient.inputSchema(ZUpgradePlanAction).action(
  withAuditLogging("subscriptionUpdated", "organization", async ({ ctx, parsedInput }) => {
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

    ctx.auditLoggingCtx.organizationId = organizationId;
    const result = await createSubscription(
      organizationId,
      parsedInput.environmentId,
      parsedInput.priceLookupKey
    );
    ctx.auditLoggingCtx.newObject = { priceLookupKey: parsedInput.priceLookupKey };
    return result;
  })
);

const ZManageSubscriptionAction = z.object({
  environmentId: ZId,
});

export const manageSubscriptionAction = authenticatedActionClient
  .inputSchema(ZManageSubscriptionAction)
  .action(
    withAuditLogging("subscriptionAccessed", "organization", async ({ ctx, parsedInput }) => {
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

      ctx.auditLoggingCtx.organizationId = organizationId;
      const result = await createCustomerPortalSession(
        organization.billing.stripeCustomerId,
        `${WEBAPP_URL}/environments/${parsedInput.environmentId}/settings/billing`
      );
      ctx.auditLoggingCtx.newObject = { portalSession: result };
      return result;
    })
  );

const ZIsSubscriptionCancelledAction = z.object({
  organizationId: ZId,
});

export const isSubscriptionCancelledAction = authenticatedActionClient
  .inputSchema(ZIsSubscriptionCancelledAction)
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
