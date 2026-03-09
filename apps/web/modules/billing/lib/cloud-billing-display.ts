import "server-only";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { type TOrganizationStripeSubscriptionStatus } from "@formbricks/types/organizations";
import { getOrganizationBillingWithReadThroughSync } from "./organization-billing";

export type TCloudBillingDisplayPlan = "hobby" | "pro" | "scale" | "unknown";

export type TCloudBillingDisplayContext = {
  organizationId: string;
  currentCloudPlan: TCloudBillingDisplayPlan;
  currentSubscriptionStatus: TOrganizationStripeSubscriptionStatus | null;
  billing: NonNullable<Awaited<ReturnType<typeof getOrganizationBillingWithReadThroughSync>>>;
};

const resolveCurrentCloudPlan = (
  billing: NonNullable<Awaited<ReturnType<typeof getOrganizationBillingWithReadThroughSync>>>
): TCloudBillingDisplayPlan => {
  return billing.stripe?.plan ?? "unknown";
};

const resolveCurrentSubscriptionStatus = (
  billing: NonNullable<Awaited<ReturnType<typeof getOrganizationBillingWithReadThroughSync>>>
): TOrganizationStripeSubscriptionStatus | null => {
  return billing.stripe?.subscriptionStatus ?? null;
};

export const getCloudBillingDisplayContext = async (
  organizationId: string
): Promise<TCloudBillingDisplayContext> => {
  const billing = await getOrganizationBillingWithReadThroughSync(organizationId);

  if (!billing) {
    throw new ResourceNotFoundError("OrganizationBilling", organizationId);
  }

  return {
    organizationId,
    currentCloudPlan: resolveCurrentCloudPlan(billing),
    currentSubscriptionStatus: resolveCurrentSubscriptionStatus(billing),
    billing,
  };
};
