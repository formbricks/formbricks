import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import {
  getOrganizationBilling,
  getOrganizationIdFromEnvironmentId,
} from "@/modules/api/v2/management/responses/lib/organization";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { logger } from "@formbricks/logger";

export const checkQuotasEnabledV1 = async (environmentId: string): Promise<boolean> => {
  try {
    const organization = await getOrganizationByEnvironmentId(environmentId);
    if (!organization) {
      return false;
    }
    const billingPlan = organization.billing.plan;

    const isQuotasAllowed = await getIsQuotasEnabled(billingPlan);
    return isQuotasAllowed;
  } catch (error) {
    logger.error({ error, environmentId }, "Error checking quotas enabled in v1");
    return false;
  }
};

export const checkQuotasEnabledV2 = async (environmentId: string): Promise<boolean> => {
  const organizationIdResult = await getOrganizationIdFromEnvironmentId(environmentId);
  if (!organizationIdResult.ok) {
    return false;
  }

  const billing = await getOrganizationBilling(organizationIdResult.data);
  if (!billing.ok) {
    return false;
  }

  const isQuotasAllowed = await getIsQuotasEnabled(billing.data.plan);
  return isQuotasAllowed;
};
