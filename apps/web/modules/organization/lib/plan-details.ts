import type { TOrganizationRole } from "@formbricks/types/memberships";
import { type TOrganizationBilling, ZOrganizationBilling } from "@formbricks/types/organizations";

type TOrganizationWithBilling = {
  billing: Omit<TOrganizationBilling, "stripe"> & { stripe?: TOrganizationBilling["stripe"] | null };
};

/**
 * The organization as a layout may send it to someone of `role`. A Dashboard viewer sees dashboards and
 * nothing of the organization's plan, so its copy carries no Stripe ids, subscription, usage cycle or
 * limits (ADR-0025); everyone else gets the billing as stored, with a missing Stripe block as
 * `undefined` the way the client types expect it.
 */
export const withPlanDetailsFor = <T extends TOrganizationWithBilling>(
  role: TOrganizationRole | undefined,
  organization: T
): Omit<T, "billing"> & { billing: TOrganizationBilling } => ({
  ...organization,
  billing:
    role === "dashboard_viewer"
      ? ZOrganizationBilling.parse({ stripeCustomerId: null, usageCycleAnchor: null })
      : { ...organization.billing, stripe: organization.billing.stripe ?? undefined },
});
