import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";

export const checkQuotasEnabled = async (environmentId: string): Promise<boolean> => {
  try {
    const organization = await getOrganizationByEnvironmentId(environmentId);
    if (!organization) {
      return false;
    }
    const billingPlan = organization.billing.plan;

    const isQuotasEnabled = await getIsQuotasEnabled(billingPlan);
    return isQuotasEnabled;
  } catch (error) {
    return false;
  }
};
