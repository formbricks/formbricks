"use server";

import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZCloudBillingInterval } from "@formbricks/types/organizations";
import { WEBAPP_URL } from "@/lib/constants";
import { getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { CLOUD_STRIPE_FEATURE_LOOKUP_KEYS } from "@/modules/billing/lib/stripe-catalog";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { createCustomerPortalSession } from "@/modules/ee/billing/api/lib/create-customer-portal-session";
import { createSetupCheckoutSession } from "@/modules/ee/billing/api/lib/create-setup-checkout-session";
import {
  addOptimisticBillingFeature,
  applySetupCheckoutUpgrade,
  createPaidPlanCheckoutSession,
  createProTrialSubscription,
  ensureCloudStripeSetupForOrganization,
  ensureStripeCustomerForOrganization,
  previewImmediateUpgradeCharge,
  reconcileCloudStripeSubscriptionsForOrganization,
  setOrganizationPaymentAttemptError,
  switchOrganizationToCloudPlan,
  syncOrganizationBillingFromStripe,
  undoPendingOrganizationPlanChange,
} from "@/modules/ee/billing/lib/organization-billing";

const ZManageSubscriptionAction = z.object({
  organizationId: ZId,
});

export const manageSubscriptionAction = authenticatedActionClient
  .inputSchema(ZManageSubscriptionAction)
  .action(
    withAuditLogging("subscriptionAccessed", "organization", async ({ ctx, parsedInput }) => {
      const { organizationId } = parsedInput;
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
        `${WEBAPP_URL}/organizations/${organizationId}/settings/billing`
      );
      ctx.auditLoggingCtx.newObject = { portalSessionCreated: true };
      return result;
    })
  );

const ZCreatePlanCheckoutAction = z.object({
  organizationId: ZId,
  targetPlan: z.enum(["pro", "scale"]),
  targetInterval: ZCloudBillingInterval,
});

export const createPlanCheckoutAction = authenticatedActionClient
  .inputSchema(ZCreatePlanCheckoutAction)
  .action(
    withAuditLogging("subscriptionAccessed", "organization", async ({ ctx, parsedInput }) => {
      const { organizationId } = parsedInput;
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

const ZGetUpgradeChargePreviewAction = z.object({
  organizationId: ZId,
  targetPlan: z.enum(["pro", "scale"]),
  targetInterval: ZCloudBillingInterval,
});

// Read-only proration preview for the upgrade confirmation modal; no audit logging since it mutates nothing.
export const getUpgradeChargePreviewAction = authenticatedActionClient
  .inputSchema(ZGetUpgradeChargePreviewAction)
  .action(async ({ ctx, parsedInput }) => {
    const { organizationId } = parsedInput;
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

    return previewImmediateUpgradeCharge({
      organizationId,
      customerId: organization.billing.stripeCustomerId,
      targetPlan: parsedInput.targetPlan,
      targetInterval: parsedInput.targetInterval,
    });
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

const ZCreateTrialPaymentCheckoutAction = z.object({
  organizationId: ZId,
  targetPlan: z.enum(["pro", "scale"]).optional(),
  targetInterval: ZCloudBillingInterval.optional(),
});

export const createTrialPaymentCheckoutAction = authenticatedActionClient
  .inputSchema(ZCreateTrialPaymentCheckoutAction)
  .action(
    withAuditLogging("subscriptionAccessed", "organization", async ({ ctx, parsedInput }) => {
      const { organizationId } = parsedInput;
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
      const returnUrl = `${WEBAPP_URL}/organizations/${organizationId}/settings/billing`;
      const upgradeIntent =
        parsedInput.targetPlan !== undefined
          ? {
              targetPlan: parsedInput.targetPlan,
              targetInterval: parsedInput.targetInterval ?? "monthly",
            }
          : undefined;
      const checkoutUrl = await createSetupCheckoutSession(
        organization.billing.stripeCustomerId,
        subscriptionId,
        returnUrl,
        organizationId,
        upgradeIntent
      );

      ctx.auditLoggingCtx.newObject = {
        setupCheckoutCreated: true,
        ...(upgradeIntent
          ? {
              targetPlan: upgradeIntent.targetPlan,
              targetInterval: upgradeIntent.targetInterval,
            }
          : {}),
      };
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

    capturePostHogEvent(
      ctx.user.id,
      "stayed_on_hobby_plan",
      {
        organization_id: parsedInput.organizationId,
      },
      { organizationId: parsedInput.organizationId }
    );

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
    // Optimistically grant ai-smart-tools so the onboarding survey page sees it
    // on the very next render, even if Stripe's entitlements API hasn't yet
    // surfaced it. The customer.subscription.created webhook will reconcile.
    await addOptimisticBillingFeature(
      parsedInput.organizationId,
      CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.AI_SMART_TOOLS
    );

    capturePostHogEvent(
      ctx.user.id,
      "free_trial_started",
      {
        plan: "pro",
        organization_id: parsedInput.organizationId,
        trial_duration_days: 14,
      },
      { organizationId: parsedInput.organizationId }
    );

    capturePostHogEvent(
      ctx.user.id,
      "reverse_trial_started",
      {
        organization_id: parsedInput.organizationId,
      },
      { organizationId: parsedInput.organizationId }
    );

    return { success: true };
  });

const ZChangeBillingPlanAction = z.discriminatedUnion("targetPlan", [
  z.object({
    organizationId: ZId,
    targetPlan: z.literal("hobby"),
    targetInterval: z.literal("monthly"),
  }),
  z.object({
    organizationId: ZId,
    targetPlan: z.enum(["pro", "scale"]),
    targetInterval: ZCloudBillingInterval,
  }),
]);

export const changeBillingPlanAction = authenticatedActionClient.inputSchema(ZChangeBillingPlanAction).action(
  withAuditLogging("subscriptionAccessed", "organization", async ({ ctx, parsedInput }) => {
    const { organizationId } = parsedInput;
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

    // Mirror the client rule server-side: a paid plan change requires a collected payment method.
    // The client routes no-card paid changes through the add-card checkout; this rejects any direct
    // call that bypasses it (e.g. a trialing no-card org trying to launder into active paid Pro).
    if (parsedInput.targetPlan !== "hobby" && organization.billing.stripe?.hasPaymentMethod !== true) {
      throw new OperationNotAllowedError("payment_method_required");
    }

    const result = await switchOrganizationToCloudPlan({
      organizationId,
      customerId: organization.billing.stripeCustomerId,
      targetPlan: parsedInput.targetPlan,
      targetInterval: parsedInput.targetInterval,
    });

    // Skip when SCA is pending: the plan is unchanged until the client confirms payment,
    // and a resync would clear the payment-failure banner. The client calls
    // waitForBillingPlanAction after confirming. Scheduled downgrades resync via webhook.
    if (result.mode === "immediate" && !result.requiresAction) {
      await syncOrganizationBillingFromStripe(organizationId);
    }

    ctx.auditLoggingCtx.organizationId = organizationId;
    ctx.auditLoggingCtx.newObject = {
      targetPlan: parsedInput.targetPlan,
      targetInterval: parsedInput.targetInterval,
      mode: result.mode,
    };

    return result;
  })
);

const ZReportUpgradePaymentIssueAction = z.object({
  organizationId: ZId,
  paymentIntentId: z.string().min(1),
});

// Persists a payment-failure banner when on-session SCA is abandoned/declined (Stripe
// does not promptly emit payment_intent.canceled on modal-close).
export const reportUpgradePaymentIssueAction = authenticatedActionClient
  .inputSchema(ZReportUpgradePaymentIssueAction)
  .action(
    withAuditLogging("subscriptionAccessed", "organization", async ({ ctx, parsedInput }) => {
      const { organizationId, paymentIntentId } = parsedInput;
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

      await setOrganizationPaymentAttemptError(organizationId, {
        type: "requires_action",
        paymentIntentId,
        message: "Payment authentication was not completed. Please try again or contact support.",
        createdAt: new Date().toISOString(),
      });

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.newObject = { paymentAttemptError: "requires_action" };
      return { success: true };
    })
  );

const ZFinalizeSetupCheckoutUpgradeAction = z.object({
  organizationId: ZId,
  checkoutSessionId: z.string().min(1),
});

// Finalizes an upgrade right after the setup-checkout redirect: attaches the saved card
// and applies the upgrade in one server call, returning any client_secret for on-session SCA.
export const finalizeSetupCheckoutUpgradeAction = authenticatedActionClient
  .inputSchema(ZFinalizeSetupCheckoutUpgradeAction)
  .action(
    withAuditLogging("subscriptionAccessed", "organization", async ({ ctx, parsedInput }) => {
      const { organizationId, checkoutSessionId } = parsedInput;
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

      const result = await applySetupCheckoutUpgrade({ organizationId, checkoutSessionId });

      if (result.mode === "immediate" && !result.requiresAction) {
        await syncOrganizationBillingFromStripe(organizationId);
      }

      ctx.auditLoggingCtx.organizationId = organizationId;
      ctx.auditLoggingCtx.newObject = { targetPlan: result.targetPlan, mode: result.mode };
      return result;
    })
  );

const ZWaitForBillingPlanAction = z.object({
  organizationId: ZId,
  targetPlan: z.enum(["hobby", "pro", "scale"]),
});

// Stripe applies the pending upgrade a beat after the invoice PaymentIntent succeeds, and
// the billing snapshot is cached. Resync (which invalidates the cache) a few times until
// the plan reflects, so the page shows the new plan without a manual refresh.
const BILLING_PLAN_SYNC_ATTEMPTS = 5;
const BILLING_PLAN_SYNC_DELAY_MS = 1200;

export const waitForBillingPlanAction = authenticatedActionClient
  .inputSchema(ZWaitForBillingPlanAction)
  .action(
    withAuditLogging("subscriptionAccessed", "organization", async ({ ctx, parsedInput }) => {
      const { organizationId, targetPlan } = parsedInput;
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

      let plan: string | null = null;
      for (let attempt = 0; attempt < BILLING_PLAN_SYNC_ATTEMPTS; attempt++) {
        const billing = await syncOrganizationBillingFromStripe(organizationId);
        plan = billing?.stripe?.plan ?? null;
        if (plan === targetPlan) break;
        if (attempt < BILLING_PLAN_SYNC_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, BILLING_PLAN_SYNC_DELAY_MS));
        }
      }

      ctx.auditLoggingCtx.organizationId = organizationId;
      return { plan };
    })
  );

const ZUndoPendingPlanChangeAction = z.object({
  organizationId: ZId,
});

export const undoPendingPlanChangeAction = authenticatedActionClient
  .inputSchema(ZUndoPendingPlanChangeAction)
  .action(
    withAuditLogging("subscriptionAccessed", "organization", async ({ ctx, parsedInput }) => {
      const { organizationId } = parsedInput;
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
