"use server";

import { TCloudBillingPlan } from "@formbricks/types/organizations";
import { getOrganizationsByUserId } from "@/lib/organization/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";

export const getIsActiveCustomerAction = authenticatedActionClient.action(async ({ ctx }) => {
  const paidBillingPlans = new Set<TCloudBillingPlan>(["pro", "scale", "custom"]);

  const organizations = await getOrganizationsByUserId(ctx.user.id);
  return organizations.some((organization) => {
    const stripe = organization.billing.stripe;
    const isPaidPlan = stripe?.plan ? paidBillingPlans.has(stripe.plan) : false;
    const isActiveSubscription =
      stripe?.subscriptionStatus === "active" || stripe?.subscriptionStatus === "trialing";
    return isPaidPlan && isActiveSubscription;
  });
});
