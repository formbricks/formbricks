import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getOrganizationIdFromEnvironmentId } from "@/modules/api/v2/management/responses/lib/organization";
import { getOrganizationBilling } from "@/modules/api/v2/management/responses/lib/organization";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";

export const checkQuotasEnabledV1 = async (environmentId: string): Promise<boolean> => {
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

export const checkQuotasEnabledV2 = async (environmentId: string): Promise<boolean> => {
  try {
    const organizationIdResult = await getOrganizationIdFromEnvironmentId(environmentId);
    if (!organizationIdResult.ok) {
      return false;
    }

    const billing = await getOrganizationBilling(organizationIdResult.data);
    if (!billing.ok) {
      return false;
    }

    const isQuotasEnabled = await getIsQuotasEnabled(billing.data.plan);
    return isQuotasEnabled;
  } catch (error) {
    return false;
  }
};
