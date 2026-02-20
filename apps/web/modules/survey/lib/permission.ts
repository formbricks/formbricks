import { Organization } from "@prisma/client";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD, PROJECT_FEATURE_KEYS } from "@/lib/constants";
import { hasCloudEntitlementWithLicenseGuard } from "@/modules/billing/lib/feature-access";
import { CLOUD_STRIPE_FEATURE_LOOKUP_KEYS } from "@/modules/billing/lib/stripe-catalog";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";

/**
 * Checks if the organization has spam protection enabled.
 * @param {string} organizationId - The ID of the organization to check.
 * @returns {Promise<void>} A promise that resolves if spam protection is enabled.
 * @throws {ResourceNotFoundError} If the organization is not found.
 * @throws {OperationNotAllowedError} If spam protection is not enabled for the organization.
 */
export const checkSpamProtectionPermission = async (organizationId: string): Promise<void> => {
  const organizationBilling = await getOrganizationBilling(organizationId);
  if (!organizationBilling) {
    throw new ResourceNotFoundError("Organization", organizationId);
  }

  const isSpamProtectionEnabled = await getIsSpamProtectionEnabled(organizationBilling.plan);
  if (!isSpamProtectionEnabled) {
    throw new OperationNotAllowedError("Spam protection is not enabled for this organization");
  }
};

export const getExternalUrlsPermission = async (
  billingPlan: Organization["billing"]["plan"],
  organizationId?: string
): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD && organizationId) {
    const [canUseCustomRedirectUrl, canUseCustomLinksInSurveys] = await Promise.all([
      hasCloudEntitlementWithLicenseGuard(
        organizationId,
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.CUSTOM_REDIRECT_URL
      ),
      hasCloudEntitlementWithLicenseGuard(
        organizationId,
        CLOUD_STRIPE_FEATURE_LOOKUP_KEYS.CUSTOM_LINKS_IN_SURVEYS
      ),
    ]);

    return canUseCustomRedirectUrl && canUseCustomLinksInSurveys;
  }

  if (IS_FORMBRICKS_CLOUD) return billingPlan !== PROJECT_FEATURE_KEYS.FREE;
  return true;
};
