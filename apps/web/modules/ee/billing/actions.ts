"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZCloudBillingInterval } from "@formbricks/types/organizations";
import { WEBAPP_URL } from "@/lib/constants";
import { getOrganization } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { createCustomerPortalSession } from "@/modules/ee/billing/api/lib/create-customer-portal-session";
import { createSetupCheckoutSession } from "@/modules/ee/billing/api/lib/create-setup-checkout-session";
import {
  createPaidPlanCheckoutSession,
  createProTrialSubscription,
  ensureCloudStripeSetupForOrganization,
  ensureStripeCustomerForOrganization,
  reconcileCloudStripeSubscriptionsForOrganization,
  switchOrganizationToCloudPlan,
  syncOrganizationBillingFromStripe,
  undoPendingOrganizationPlanChange,
} from "@/modules/ee/billing/lib/organization-billing";

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
        throw new ResourceNotFoundError("OrganizationBilling", organizationId);
      }

      ctx.auditLoggingCtx.organizationId = organizationId;
      const result = await createCustomerPortalSession(
        organization.billing.stripeCustomerId,
        `${WEBAPP_URL}/environments/${parsedInput.environmentId}/settings/billing`
      );
      ctx.auditLoggingCtx.newObject = { portalSessionCreated: true };
      return result;
    })
  );

const ZCreatePlanCheckoutAction = z.object({
  environmentId: ZId,
  targetPlan: z.enum(["pro", "scale"]),
  targetInterval: ZCloudBillingInterval,
});

export const createPlanCheckoutAction = authenticatedActionClient
  .inputSchema(ZCreatePlanCheckoutAction)
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

      if (!organization.billing?.stripeCustomerId) {
        throw new ResourceNotFoundError("OrganizationBilling", organizationId);
      }

      if (organization.billing.stripe?.subscriptionId) {
        throw new OperationNotAllowedError("paid_checkout_requires_no_existing_subscription");
      }

      const checkoutUrl = await createPaidPlanCheckoutSession({
        organizationId,
        customerId: organization.billing.stripeCustomerId,
        environmentId: parsedInput.environmentId,
        plan: parsedInput.targetPlan,
        interval: parsedInput.targetInterval,
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.newObject = {
        checkoutCreated: true,
        targetPlan: parsedInput.targetPlan,
        targetInterval: parsedInput.targetInterval,
      };

      return checkoutUrl;
    })
  );

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

const ZCreateTrialPaymentCheckoutAction = z.object({
  environmentId: ZId,
});

export const createTrialPaymentCheckoutAction = authenticatedActionClient
  .inputSchema(ZCreateTrialPaymentCheckoutAction)
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
        throw new ResourceNotFoundError("OrganizationBilling", organizationId);
      }

      const subscriptionId = organization.billing.stripe?.subscriptionId;
      if (!subscriptionId) {
        throw new ResourceNotFoundError("subscription", organizationId);
      }

      ctx.auditLoggingCtx.organizationId = organizationId;
      const returnUrl = `${WEBAPP_URL}/environments/${parsedInput.environmentId}/settings/billing`;
      const checkoutUrl = await createSetupCheckoutSession(
        organization.billing.stripeCustomerId,
        subscriptionId,
        returnUrl,
        organizationId
      );

      ctx.auditLoggingCtx.newObject = { setupCheckoutCreated: true };
      return checkoutUrl;
    })
  );

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

    await reconcileCloudStripeSubscriptionsForOrganization(parsedInput.organizationId);
    await syncOrganizationBillingFromStripe(parsedInput.organizationId);
    return { success: true };
  });

export const startProTrialAction = authenticatedActionClient
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

    await createProTrialSubscription(parsedInput.organizationId, customerId);
    await reconcileCloudStripeSubscriptionsForOrganization(parsedInput.organizationId);
    await syncOrganizationBillingFromStripe(parsedInput.organizationId);
    return { success: true };
  });

const ZChangeBillingPlanAction = z.discriminatedUnion("targetPlan", [
  z.object({
    environmentId: ZId,
    targetPlan: z.literal("hobby"),
    targetInterval: z.literal("monthly"),
  }),
  z.object({
    environmentId: ZId,
    targetPlan: z.enum(["pro", "scale"]),
    targetInterval: ZCloudBillingInterval,
  }),
]);

export const changeBillingPlanAction = authenticatedActionClient.inputSchema(ZChangeBillingPlanAction).action(
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
      throw new ResourceNotFoundError("OrganizationBilling", organizationId);
    }

    const result = await switchOrganizationToCloudPlan({
      organizationId,
      customerId: organization.billing.stripeCustomerId,
      targetPlan: parsedInput.targetPlan,
      targetInterval: parsedInput.targetInterval,
    });

    if (result.mode === "immediate") {
      await syncOrganizationBillingFromStripe(organizationId);
    }
    // Scheduled downgrades already persist the pending snapshot locally and
    // the ensuing subscription_schedule webhook performs the full Stripe resync.

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.newObject = {
      targetPlan: parsedInput.targetPlan,
      targetInterval: parsedInput.targetInterval,
      mode: result.mode,
    };

    return result;
  })
);

const ZUndoPendingPlanChangeAction = z.object({
  environmentId: ZId,
});

export const undoPendingPlanChangeAction = authenticatedActionClient
  .inputSchema(ZUndoPendingPlanChangeAction)
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
        throw new ResourceNotFoundError("OrganizationBilling", organizationId);
      }

      await undoPendingOrganizationPlanChange(organizationId, organization.billing.stripeCustomerId);
      await syncOrganizationBillingFromStripe(organizationId);

      ctx.auditLoggingCtx.organizationId = organizationId;
      return { success: true };
    })
  );
