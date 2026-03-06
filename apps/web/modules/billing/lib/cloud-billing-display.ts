import "server-only";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationBillingWithReadThroughSync } from "./organization-billing";

export type TCloudBillingDisplayPlan = "hobby" | "pro" | "scale" | "trial" | "unknown";

export type TCloudBillingDisplayContext = {
  organizationId: string;
  currentCloudPlan: TCloudBillingDisplayPlan;
  billing: NonNullable<Awaited<ReturnType<typeof getOrganizationBillingWithReadThroughSync>>>;
};

const resolveCurrentCloudPlan = (
  billing: NonNullable<Awaited<ReturnType<typeof getOrganizationBillingWithReadThroughSync>>>
): TCloudBillingDisplayPlan => {
  return billing.stripe?.plan ?? "unknown";
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
    billing,
  };
};
