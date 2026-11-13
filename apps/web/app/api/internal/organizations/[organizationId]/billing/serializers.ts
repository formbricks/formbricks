import type { TCloudBillingPlan, TOrganizationStripePendingChange } from "@formbricks/types/organizations";

/** A Stripe-hosted page to send the browser to: the customer portal or a Checkout Session. */
export type TBillingRedirectResource = { url: string };

export const serializeBillingRedirect = (url: string): TBillingRedirectResource => ({ url });

/** What an immediate upgrade would charge now, tax included; `null` when Stripe can't price it. */
export type TBillingUpgradeChargePreviewResource = { amountDue: number; currency: string } | null;

export const serializeUpgradeChargePreview = (
  preview: { amountDue: number; currency: string } | null
): TBillingUpgradeChargePreviewResource =>
  preview ? { amountDue: preview.amountDue, currency: preview.currency } : null;

/** A plan change Stripe accepted: applied now (with an invoice to confirm when `requiresAction`) or scheduled. */
export type TBillingPlanChangeResource = {
  mode: "immediate" | "scheduled";
  pendingChange: TOrganizationStripePendingChange | null;
  clientSecret: string | null;
  requiresAction: boolean;
};

export const serializePlanChange = (result: {
  mode: "immediate" | "scheduled";
  pendingChange: TOrganizationStripePendingChange | null;
  clientSecret?: string | null;
  requiresAction?: boolean;
}): TBillingPlanChangeResource => ({
  mode: result.mode,
  pendingChange: result.pendingChange
    ? {
        type: result.pendingChange.type,
        targetPlan: result.pendingChange.targetPlan,
        targetInterval: result.pendingChange.targetInterval,
        effectiveAt: result.pendingChange.effectiveAt,
      }
    : null,
  clientSecret: result.clientSecret ?? null,
  requiresAction: result.requiresAction ?? false,
});

/** A finalized setup-checkout upgrade; `targetPlan` is null when the checkout carried none to apply. */
export type TBillingSetupCheckoutUpgradeResource = {
  mode: "immediate" | "scheduled";
  clientSecret: string | null;
  requiresAction: boolean;
  targetPlan: "pro" | "scale" | null;
};

export const serializeSetupCheckoutUpgrade = (
  result: TBillingSetupCheckoutUpgradeResource
): TBillingSetupCheckoutUpgradeResource => ({
  mode: result.mode,
  clientSecret: result.clientSecret,
  requiresAction: result.requiresAction,
  targetPlan: result.targetPlan,
});

/** The plan the synced billing shows once the wait ended; `null` without a Stripe snapshot. */
export type TBillingPlanWaitResource = { plan: TCloudBillingPlan | null };

/** Whether the synced billing shows a payment method once the wait ended. */
export type TBillingPaymentMethodWaitResource = { hasPaymentMethod: boolean };
