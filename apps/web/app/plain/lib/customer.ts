import "server-only";
import { TCloudBillingPlan } from "@formbricks/types/organizations";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getOrganizationsByUserId } from "@/lib/organization/service";

const PAID_BILLING_PLANS = new Set<TCloudBillingPlan>(["pro", "scale"]);

/**
 * Whether the user belongs to at least one organization on a paid, active plan.
 * Resolved server-side so the active-customer label can be attached to Plain
 * threads at init time, before the user opens their first thread.
 *
 * Stripe billing plans only exist on Formbricks Cloud, so self-hosted instances
 * short-circuit to false instead of querying the user's organizations.
 */
export const getIsActiveCustomer = async (userId: string): Promise<boolean> => {
  if (!IS_FORMBRICKS_CLOUD) {
    return false;
  }

  const organizations = await getOrganizationsByUserId(userId);
  return organizations.some((organization) => {
    const stripe = organization.billing.stripe;
    const isPaidPlan = stripe?.plan ? PAID_BILLING_PLANS.has(stripe.plan) : false;
    const isActiveSubscription =
      stripe?.subscriptionStatus === "active" || stripe?.subscriptionStatus === "trialing";
    return isPaidPlan && isActiveSubscription;
  });
};
