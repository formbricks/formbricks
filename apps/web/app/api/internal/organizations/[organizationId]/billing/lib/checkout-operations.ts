import "server-only";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import { WEBAPP_URL } from "@/lib/constants";
import { createCustomerPortalSession } from "@/modules/ee/billing/api/lib/create-customer-portal-session";
import { createSetupCheckoutSession } from "@/modules/ee/billing/api/lib/create-setup-checkout-session";
import {
  createPaidPlanCheckoutSession,
  previewImmediateUpgradeCharge,
} from "@/modules/ee/billing/lib/organization-billing";
import type {
  TBillingCheckoutSessionBody,
  TBillingSetupCheckoutSessionBody,
  TBillingUpgradeChargePreviewQuery,
} from "../schemas";
import { serializeBillingRedirect, serializeUpgradeChargePreview } from "../serializers";
import {
  type TBillingRequestContext,
  answerRefusals,
  getBillingCustomerOrRefuse,
  requireBillingAccess,
  requireIntentKey,
  stripeIntentKey,
} from "./context";

/** Where Stripe sends the customer back to: the organization's billing settings. */
const billingSettingsUrl = (organizationId: string) =>
  `${WEBAPP_URL}/organizations/${organizationId}/settings/billing`;

type TIntentRequestContext = TBillingRequestContext & { req: Request };

/**
 * `POST …/billing/portal-sessions`: a Stripe customer portal session for the organization, which the
 * billing page opens. Billing managers only; audited as `subscriptionAccessed`.
 */
export async function createBillingPortalSessionOperation(
  context: TBillingRequestContext
): Promise<Response> {
  const { organizationId, requestId, auditLog } = context;
  const access = await requireBillingAccess(context, {
    action: "organization.manage_billing",
    chargeStateMutation: true,
  });
  if (access instanceof Response) return access;

  const billing = await getBillingCustomerOrRefuse(context);
  if (billing instanceof Response) return billing;

  const url = await createCustomerPortalSession(billing.customerId, billingSettingsUrl(organizationId));
  if (auditLog) auditLog.newObject = { portalSessionCreated: true };
  return successResponse(serializeBillingRedirect(url), { requestId });
}

/**
 * `POST …/billing/checkout-sessions`: a Stripe Checkout Session buying a paid plan, for an organization
 * that has no subscription yet; one with a subscription adds a card through a setup checkout instead
 * (403 `paid_checkout_requires_no_existing_subscription`). Takes an `Idempotency-Key`, one per click: a
 * retry of the same click gets the same Checkout Session back.
 */
export async function createBillingCheckoutSessionOperation({
  body,
  ...context
}: TIntentRequestContext & { body: TBillingCheckoutSessionBody }): Promise<Response> {
  const { organizationId, requestId, auditLog } = context;
  const intentKey = requireIntentKey(context.req, context);
  if (intentKey instanceof Response) return intentKey;

  const access = await requireBillingAccess(context, {
    action: "organization.manage_billing",
    chargeStateMutation: true,
  });
  if (access instanceof Response) return access;

  return answerRefusals(context, async () => {
    const billing = await getBillingCustomerOrRefuse(context);
    if (billing instanceof Response) return billing;
    if (billing.organization.billing.stripe?.subscriptionId) {
      throw new OperationNotAllowedError("paid_checkout_requires_no_existing_subscription");
    }

    const url = await createPaidPlanCheckoutSession({
      organizationId,
      customerId: billing.customerId,
      plan: body.targetPlan,
      interval: body.targetInterval,
      idempotencyKey: stripeIntentKey("plan-checkout", organizationId, intentKey),
    });
    if (auditLog) {
      auditLog.newObject = {
        checkoutCreated: true,
        targetPlan: body.targetPlan,
        targetInterval: body.targetInterval,
      };
    }
    return successResponse(serializeBillingRedirect(url), { requestId });
  });
}

/**
 * `POST …/billing/setup-checkout-sessions`: a setup-mode Checkout Session that adds a card to the
 * organization's subscription, and with `targetPlan` upgrades to it once the card is saved. Takes an
 * `Idempotency-Key`, one per click.
 */
export async function createBillingSetupCheckoutSessionOperation({
  body,
  ...context
}: TIntentRequestContext & { body: TBillingSetupCheckoutSessionBody }): Promise<Response> {
  const { organizationId, requestId, instance, auditLog } = context;
  const intentKey = requireIntentKey(context.req, context);
  if (intentKey instanceof Response) return intentKey;

  const access = await requireBillingAccess(context, {
    action: "organization.manage_billing",
    chargeStateMutation: true,
  });
  if (access instanceof Response) return access;

  const billing = await getBillingCustomerOrRefuse(context);
  if (billing instanceof Response) return billing;
  const subscriptionId = billing.organization.billing.stripe?.subscriptionId;
  // No subscription to add a card to: the action's ResourceNotFoundError, the uniform 403.
  if (!subscriptionId) return problemForbidden(requestId, undefined, instance);

  const upgradeIntent =
    body.targetPlan === undefined
      ? undefined
      : { targetPlan: body.targetPlan, targetInterval: body.targetInterval ?? "monthly" };
  const url = await createSetupCheckoutSession(
    billing.customerId,
    subscriptionId,
    billingSettingsUrl(organizationId),
    organizationId,
    upgradeIntent,
    stripeIntentKey("setup-checkout", organizationId, intentKey)
  );
  if (auditLog) {
    auditLog.newObject = {
      setupCheckoutCreated: true,
      ...(upgradeIntent
        ? { targetPlan: upgradeIntent.targetPlan, targetInterval: upgradeIntent.targetInterval }
        : {}),
    };
  }
  return successResponse(serializeBillingRedirect(url), { requestId });
}

/**
 * `GET …/billing/upgrade-charge-preview`: what an immediate upgrade to the plan would charge now, tax
 * included, for the confirmation modal; `null` when Stripe can't price it. Read-only, so not audited.
 */
export async function getUpgradeChargePreviewOperation({
  query,
  ...context
}: TBillingRequestContext & { query: TBillingUpgradeChargePreviewQuery }): Promise<Response> {
  const { organizationId, requestId } = context;
  const access = await requireBillingAccess(context, {
    action: "organization.manage_billing",
    chargeStateMutation: false,
  });
  if (access instanceof Response) return access;

  return answerRefusals(context, async () => {
    const billing = await getBillingCustomerOrRefuse(context);
    if (billing instanceof Response) return billing;

    const preview = await previewImmediateUpgradeCharge({
      organizationId,
      customerId: billing.customerId,
      targetPlan: query.targetPlan,
      targetInterval: query.targetInterval,
    });
    return successResponse(serializeUpgradeChargePreview(preview), { requestId });
  });
}
