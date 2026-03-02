import { Organization } from "@prisma/client";
import { IS_FORMBRICKS_CLOUD, PROJECT_FEATURE_KEYS } from "@/lib/constants";
import { hasCloudEntitlementWithLicenseGuard } from "@/modules/billing/lib/feature-access";
import { CLOUD_STRIPE_FEATURE_LOOKUP_KEYS } from "@/modules/billing/lib/stripe-catalog";

export const getSurveyFollowUpsPermission = async (
  billingPlan: Organization["billing"]["plan"],
  organizationId?: string
): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) {
    if (organizationId) {
      return hasCloudEntitlementWithLicenseGuard(organizationId, CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.FOLLOW_UPS);
    }
    // Legacy fallback for call sites that don't pass organizationId yet.
    return billingPlan === PROJECT_FEATURE_KEYS.CUSTOM;
  }
  return true;
};
