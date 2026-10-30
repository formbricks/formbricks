import type { TOrganizationBilling, TOrganizationBillingPlanLimits } from "@formbricks/types/organizations";

/**
 * What the dashboard reads of an organization's billing: its plan limits. The Stripe customer, the
 * subscription and the payment state stay out — the billing page reads those on the server.
 */
export type TOrganizationBillingLimitsResource = { limits: TOrganizationBillingPlanLimits };

export const serializeOrganizationBillingLimits = (
  billing: TOrganizationBilling
): TOrganizationBillingLimitsResource => ({
  limits: {
    workspaces: billing.limits.workspaces,
    monthly: {
      responses: billing.limits.monthly.responses,
      workflowRuns: billing.limits.monthly.workflowRuns ?? null,
    },
  },
});
