import { getIsSpamProtectionEnabled } from "@/modules/ee/license-check/lib/utils";
import { OperationNotAllowedError } from "@formbricks/types/errors";

/**
 * Checks if the organization has spam protection enabled.
 *
 * @returns {Promise<void>} A promise that resolves if spam protection is enabled.
 * @throws {OperationNotAllowedError} If spam protection is not enabled for the organization.
 */
export const checkSpamProtectionPermission = async (): Promise<void> => {
  const isSpamProtectionEnabled = await getIsSpamProtectionEnabled();
  if (!isSpamProtectionEnabled) {
    throw new OperationNotAllowedError("Spam protection is not enabled for this organization");
  }
};
