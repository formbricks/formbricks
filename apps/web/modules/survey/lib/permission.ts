import { OperationNotAllowedError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { hasCloudEntitlementWithLicenseGuard } from "@/modules/billing/lib/feature-access";
import { CLOUD_STRIPE_FEATURE_LOOKUP_KEYS } from "@/modules/billing/lib/stripe-catalog";
import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";

/**
 * Checks if the organization has spam protection enabled.
 * @param {string} organizationId - The ID of the organization to check.
 * @returns {Promise<void>} A promise that resolves if spam protection is enabled.
 * @throws {OperationNotAllowedError} If spam protection is not enabled for the organization.
 */
export const checkSpamProtectionPermission = async (organizationId: string): Promise<void> => {
  const isSpamProtectionEnabled = await getIsSpamProtectionEnabled(organizationId);
  if (!isSpamProtectionEnabled) {
    throw new OperationNotAllowedError("Spam protection is not enabled for this organization");
  }
};

export const getExternalUrlsPermission = async (organizationId: string): Promise<boolean> => {
  if (IS_FORMBRICKS_CLOUD) {
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

  return true;
};
