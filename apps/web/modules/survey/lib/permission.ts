import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";

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
