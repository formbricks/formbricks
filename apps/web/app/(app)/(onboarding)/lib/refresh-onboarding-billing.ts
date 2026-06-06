import "server-only";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { invalidateOrganizationBillingCache } from "@/modules/ee/billing/lib/organization-billing";

export const refreshOnboardingBillingSnapshot = async (organizationId: string): Promise<void> => {
  if (!IS_FORMBRICKS_CLOUD) {
    return;
  }

  await invalidateOrganizationBillingCache(organizationId);
};
