"use server";

import { getServerSession } from "next-auth";
import { getOrganizationsByUserId } from "@/lib/organization/service";
import { authOptions } from "@/modules/auth/lib/authOptions";

export const getIsActiveCustomer = async (): Promise<boolean> => {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return false;

  const organizations = await getOrganizationsByUserId(session.user.id);
  return organizations.some((organization) => {
    const stripe = organization.billing.stripe;
    const isPaidPlan = stripe?.plan === "pro" || stripe?.plan === "scale" || stripe?.plan === "custom";
    const isActiveSubscription =
      stripe?.subscriptionStatus === "active" || stripe?.subscriptionStatus === "trialing";
    return isPaidPlan && isActiveSubscription;
  });
};
