import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { hasCloudEntitlementWithLicenseGuard } from "@/modules/billing/lib/feature-access";
import type { TOrganizationPermissionContext } from "@/modules/billing/lib/organization-permission-context";
import { CLOUD_STRIPE_FEATURE_LOOKUP_KEYS } from "@/modules/billing/lib/stripe-catalog";

export const getSurveyFollowUpsPermission = async (
  context: TOrganizationPermissionContext
): Promise<boolean> => {
  const { organizationId } = context;

  if (IS_FORMBRICKS_CLOUD) {
    return hasCloudEntitlementWithLicenseGuard(organizationId, CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.FOLLOW_UPS);
  }
  return true;
};
