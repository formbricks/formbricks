import "server-only";
import { TCloudBillingPlan } from "@formbricks/types/organizations";
import { getOrganizationsByUserId } from "@/lib/organization/service";

const PAID_BILLING_PLANS = new Set<TCloudBillingPlan>(["pro", "scale"]);

/**
 * Whether the user belongs to at least one organization on a paid, active plan.
 * Resolved server-side so the active-customer label can be attached to Plain
 * threads at init time, before the user opens their first thread.
 */
export const getIsActiveCustomer = async (userId: string): Promise<boolean> => {
  const organizations = await getOrganizationsByUserId(userId);
  return organizations.some((organization) => {
    const stripe = organization.billing.stripe;
    const isPaidPlan = stripe?.plan ? PAID_BILLING_PLANS.has(stripe.plan) : false;
    const isActiveSubscription =
      stripe?.subscriptionStatus === "active" || stripe?.subscriptionStatus === "trialing";
    return isPaidPlan && isActiveSubscription;
  });
};
