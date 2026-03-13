"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { WEBAPP_URL } from "@/lib/constants";
import { getOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { createCustomerPortalSession } from "@/modules/ee/billing/api/lib/create-customer-portal-session";
import { isSubscriptionCancelled } from "@/modules/ee/billing/api/lib/is-subscription-cancelled";
import {
  createScaleTrialSubscription,
  ensureCloudStripeSetupForOrganization,
  ensureStripeCustomerForOrganization,
  reconcileCloudStripeSubscriptionsForOrganization,
  syncOrganizationBillingFromStripe,
} from "@/modules/ee/billing/lib/organization-billing";
import { stripeClient } from "@/modules/ee/billing/lib/stripe-client";

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

const ZCreatePricingTableCustomerSessionAction = z.object({
  environmentId: ZId,
});

export const createPricingTableCustomerSessionAction = authenticatedActionClient
  .inputSchema(ZCreatePricingTableCustomerSessionAction)
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

    if (!organization.billing?.stripeCustomerId) {
      throw new ResourceNotFoundError("OrganizationBilling", organizationId);
    }

    if (!stripeClient) {
      return { clientSecret: null };
    }

    const customerSession = await stripeClient.customerSessions.create({
      customer: organization.billing.stripeCustomerId,
      components: {
        pricing_table: {
          enabled: true,
        },
      },
    });

    return { clientSecret: customerSession.client_secret ?? null };
  });

const ZRetryStripeSetupAction = z.object({
  organizationId: ZId,
});

export const retryStripeSetupAction = authenticatedActionClient
  .inputSchema(ZRetryStripeSetupAction)
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

    await ensureCloudStripeSetupForOrganization(parsedInput.organizationId);
    return { success: true };
  });

const ZStartScaleTrialAction = z.object({
  organizationId: ZId,
});

export const startHobbyAction = authenticatedActionClient
  .inputSchema(ZStartScaleTrialAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    const organization = await getOrganization(parsedInput.organizationId);
    if (!organization) {
      throw new ResourceNotFoundError("organization", parsedInput.organizationId);
    }

    const customerId =
      organization.billing?.stripeCustomerId ??
      (await ensureStripeCustomerForOrganization(parsedInput.organizationId)).customerId;
    if (!customerId) {
      throw new ResourceNotFoundError("OrganizationBilling", parsedInput.organizationId);
    }

    await reconcileCloudStripeSubscriptionsForOrganization(parsedInput.organizationId, "start-hobby");
    await syncOrganizationBillingFromStripe(parsedInput.organizationId);
    return { success: true };
  });

export const startScaleTrialAction = authenticatedActionClient
  .inputSchema(ZStartScaleTrialAction)
  .action(async ({ ctx, parsedInput }) => {
    await checkAuthorizationUpdated({
      userId: ctx.user.id,
      organizationId: parsedInput.organizationId,
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
      ],
    });

    const organization = await getOrganization(parsedInput.organizationId);
    if (!organization) {
      throw new ResourceNotFoundError("organization", parsedInput.organizationId);
    }

    const customerId =
      organization.billing?.stripeCustomerId ??
      (await ensureStripeCustomerForOrganization(parsedInput.organizationId)).customerId;
    if (!customerId) {
      throw new ResourceNotFoundError("OrganizationBilling", parsedInput.organizationId);
    }

    await createScaleTrialSubscription(parsedInput.organizationId, customerId);
    await reconcileCloudStripeSubscriptionsForOrganization(parsedInput.organizationId, "scale-trial");
    await syncOrganizationBillingFromStripe(parsedInput.organizationId);
    return { success: true };
  });
