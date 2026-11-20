import "server-only";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { noContentResponse, problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import { getOrganization } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { CLOUD_STRIPE_FEATURE_LOOKUP_KEYS } from "@/modules/billing/lib/stripe-catalog";
import {
  addOptimisticBillingFeature,
  applySetupCheckoutUpgrade,
  createProTrialSubscription,
  ensureCloudStripeSetupForOrganization,
  ensureStripeCustomerForOrganization,
  getProTrialDays,
  reconcileCloudStripeSubscriptionsForOrganization,
  setOrganizationPaymentAttemptError,
  switchOrganizationToCloudPlan,
  syncOrganizationBillingFromStripe,
  undoPendingOrganizationPlanChange,
} from "@/modules/ee/billing/lib/organization-billing";
import type {
  TBillingPaymentIssueBody,
  TBillingPlanChangeBody,
  TBillingSetupCheckoutUpgradeBody,
} from "../schemas";
import { serializePlanChange, serializeSetupCheckoutUpgrade } from "../serializers";
import {
  type TBillingRequestContext,
  answerRefusals,
  getBillingCustomerOrRefuse,
  requireBillingAccess,
  requireIntentKey,
  runHoldingBillingLock,
  stripeIntentKey,
} from "./context";

/**
 * The organization's Stripe customer for the onboarding plan choice: the one on file, or one created now.
 * The uniform 403 when the organization is gone, or no customer can be had (Stripe isn't configured).
 */
async function ensureBillingCustomer(context: TBillingRequestContext): Promise<Response | string> {
  const { organizationId, requestId, instance } = context;
  const organization = await getOrganization(organizationId);
  if (!organization) return problemForbidden(requestId, undefined, instance);

  const customerId =
    organization.billing?.stripeCustomerId ??
    (await ensureStripeCustomerForOrganization(organizationId)).customerId;
  return customerId ?? problemForbidden(requestId, undefined, instance);
}

/**
 * `POST …/billing/stripe-setups`: provision the organization's Stripe customer and Hobby subscription
 * again, for an organization whose setup failed when it was created. Billing managers only. Audited as
 * `subscriptionAccessed`, which the server action it replaces was not.
 */
export async function retryStripeSetupOperation(context: TBillingRequestContext): Promise<Response> {
  const { organizationId, requestId, auditLog } = context;
  const access = await requireBillingAccess(context, {
    action: "organization.manage_billing",
    chargeStateMutation: true,
  });
  if (access instanceof Response) return access;

  return runHoldingBillingLock(context, () =>
    answerRefusals(context, async () => {
      await ensureCloudStripeSetupForOrganization(organizationId);
      if (auditLog) auditLog.newObject = { stripeSetupEnsured: true };
      return noContentResponse({ requestId });
    })
  );
}

/**
 * `POST …/billing/hobby-subscriptions`: the onboarding "continue on Hobby" choice — make sure the
 * organization has a Stripe customer and its free Hobby subscription. Owners and managers
 * (`organization.manage`). Audited as `subscriptionAccessed`, which the server action it replaces was not.
 */
export async function startHobbyPlanOperation(context: TBillingRequestContext): Promise<Response> {
  const { organizationId, requestId, auditLog } = context;
  const access = await requireBillingAccess(context, {
    action: "organization.manage",
    chargeStateMutation: true,
  });
  if (access instanceof Response) return access;

  return runHoldingBillingLock(context, () =>
    answerRefusals(context, async () => {
      const customerId = await ensureBillingCustomer(context);
      if (customerId instanceof Response) return customerId;

      await reconcileCloudStripeSubscriptionsForOrganization(organizationId);
      await syncOrganizationBillingFromStripe(organizationId);

      capturePostHogEvent(
        access.userId,
        "stayed_on_hobby_plan",
        { organization_id: organizationId },
        { organizationId }
      );
      if (auditLog) auditLog.newObject = { plan: "hobby" };
      return noContentResponse({ requestId });
    })
  );
}

/**
 * `POST …/billing/pro-trials`: the onboarding "start the free trial" choice — a Pro trial subscription,
 * once per customer (403 `trial_already_used` after that). Owners and managers (`organization.manage`).
 */
export async function startProTrialOperation(context: TBillingRequestContext): Promise<Response> {
  const { organizationId, requestId, auditLog } = context;
  const access = await requireBillingAccess(context, {
    action: "organization.manage",
    chargeStateMutation: true,
  });
  if (access instanceof Response) return access;

  return runHoldingBillingLock(context, () =>
    answerRefusals(context, async () => {
      const customerId = await ensureBillingCustomer(context);
      if (customerId instanceof Response) return customerId;

      const trialDays = await getProTrialDays(organizationId);
      await createProTrialSubscription(organizationId, customerId, trialDays);
      await reconcileCloudStripeSubscriptionsForOrganization(organizationId);
      const syncedBilling = await syncOrganizationBillingFromStripe(organizationId);
      // The end date as Stripe recorded it, so lifecycle emails can count down to it.
      const trialEndTime = new Date(syncedBilling?.stripe?.trialEnd ?? "").getTime();
      // Optimistically grant ai-smart-tools so the onboarding survey page sees it on the very next render,
      // even if Stripe's entitlements API hasn't surfaced it yet. The subscription webhook reconciles.
      await addOptimisticBillingFeature(organizationId, CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.AI_SMART_TOOLS);

      capturePostHogEvent(
        access.userId,
        "free_trial_started",
        { plan: "pro", organization_id: organizationId, trial_duration_days: trialDays },
        { organizationId }
      );
      capturePostHogEvent(
        access.userId,
        "reverse_trial_started",
        {
          organization_id: organizationId,
          trial_end: Number.isFinite(trialEndTime) ? new Date(trialEndTime).toISOString() : null,
          trial_duration_days: trialDays,
        },
        { organizationId }
      );

      if (auditLog) auditLog.newObject = { plan: "pro", trialDurationDays: trialDays };
      return noContentResponse({ requestId });
    })
  );
}

/**
 * `POST …/billing/plan-changes`: switch the organization's plan — an upgrade or trial conversion applies
 * now (with an invoice to confirm on-session when `requiresAction`), a downgrade is scheduled for the period
 * end. A paid target needs a payment method on file (403 `payment_method_required`), as the page enforces.
 * Takes an `Idempotency-Key`, one per click: every Stripe write the change makes carries it.
 */
export async function changeBillingPlanOperation({
  req,
  body,
  ...context
}: TBillingRequestContext & { req: Request; body: TBillingPlanChangeBody }): Promise<Response> {
  const { organizationId, requestId, auditLog } = context;
  const access = await requireBillingAccess(context, {
    action: "organization.manage_billing",
    chargeStateMutation: true,
  });
  if (access instanceof Response) return access;

  const intentKey = requireIntentKey(req, context);
  if (intentKey instanceof Response) return intentKey;

  return runHoldingBillingLock(context, () =>
    answerRefusals(context, async () => {
      const billing = await getBillingCustomerOrRefuse(context);
      if (billing instanceof Response) return billing;

      // Mirror the client rule server-side: paid plan changes require a payment method, rejecting direct
      // calls that bypass the add-card checkout (e.g. laundering a no-card trial into paid Pro).
      if (body.targetPlan !== "hobby" && billing.organization.billing.stripe?.hasPaymentMethod !== true) {
        throw new OperationNotAllowedError("payment_method_required");
      }

      const result = await switchOrganizationToCloudPlan({
        organizationId,
        customerId: billing.customerId,
        targetPlan: body.targetPlan,
        targetInterval: body.targetInterval,
        idempotencyKey: stripeIntentKey("plan-change", organizationId, intentKey),
      });

      // Skip when SCA is pending: the plan is unchanged until the client confirms payment, and a resync
      // would clear the payment-failure banner. The page waits on plan-waits after confirming. Scheduled
      // downgrades resync via webhook.
      if (result.mode === "immediate" && !result.requiresAction) {
        await syncOrganizationBillingFromStripe(organizationId);
      }

      if (auditLog) {
        auditLog.newObject = {
          targetPlan: body.targetPlan,
          targetInterval: body.targetInterval,
          mode: result.mode,
        };
      }
      return successResponse(serializePlanChange(result), { requestId });
    })
  );
}

/**
 * `DELETE …/billing/pending-plan-change`: undo a scheduled downgrade, keeping the current plan.
 */
export async function undoPendingPlanChangeOperation(context: TBillingRequestContext): Promise<Response> {
  const { organizationId, requestId } = context;
  const access = await requireBillingAccess(context, {
    action: "organization.manage_billing",
    chargeStateMutation: true,
  });
  if (access instanceof Response) return access;

  return runHoldingBillingLock(context, () =>
    answerRefusals(context, async () => {
      const billing = await getBillingCustomerOrRefuse(context);
      if (billing instanceof Response) return billing;

      await undoPendingOrganizationPlanChange(organizationId, billing.customerId);
      await syncOrganizationBillingFromStripe(organizationId);
      return noContentResponse({ requestId });
    })
  );
}

/**
 * `POST …/billing/payment-issues`: record that on-session authentication of an upgrade's payment was
 * abandoned or declined, so the billing page shows the payment-failure banner (Stripe does not promptly
 * emit `payment_intent.canceled` when the 3D Secure modal is closed).
 */
export async function reportUpgradePaymentIssueOperation({
  body,
  ...context
}: TBillingRequestContext & { body: TBillingPaymentIssueBody }): Promise<Response> {
  const { organizationId, requestId, auditLog } = context;
  const access = await requireBillingAccess(context, {
    action: "organization.manage_billing",
    chargeStateMutation: true,
  });
  if (access instanceof Response) return access;

  return answerRefusals(context, async () => {
    await setOrganizationPaymentAttemptError(organizationId, {
      type: "requires_action",
      paymentIntentId: body.paymentIntentId,
      message: "Payment authentication was not completed. Please try again or contact support.",
      createdAt: new Date().toISOString(),
    });
    if (auditLog) auditLog.newObject = { paymentAttemptError: "requires_action" };
    return noContentResponse({ requestId });
  });
}

/**
 * `POST …/billing/setup-checkout-upgrades`: finalize the upgrade a completed setup checkout carried, right
 * after Stripe redirects back: attach the saved card and apply the upgrade, answering any invoice to confirm
 * on-session. A repeat for the same checkout finds the upgrade applied and charges nothing again.
 */
export async function finalizeSetupCheckoutUpgradeOperation({
  body,
  ...context
}: TBillingRequestContext & { body: TBillingSetupCheckoutUpgradeBody }): Promise<Response> {
  const { organizationId, requestId, auditLog } = context;
  const access = await requireBillingAccess(context, {
    action: "organization.manage_billing",
    chargeStateMutation: true,
  });
  if (access instanceof Response) return access;

  return runHoldingBillingLock(context, () =>
    answerRefusals(context, async () => {
      const result = await applySetupCheckoutUpgrade({
        organizationId,
        checkoutSessionId: body.checkoutSessionId,
      });

      if (result.mode === "immediate" && !result.requiresAction) {
        await syncOrganizationBillingFromStripe(organizationId);
      }

      if (auditLog) auditLog.newObject = { targetPlan: result.targetPlan, mode: result.mode };
      return successResponse(serializeSetupCheckoutUpgrade(result), { requestId });
    })
  );
}
