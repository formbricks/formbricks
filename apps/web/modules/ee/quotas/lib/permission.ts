import "server-only";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { getIsQuotasEnabled } from "@/modules/ee/license-check/lib/utils";
import { getOrganizationBilling } from "@/modules/survey/lib/survey";

/**
 * The licence gate every quota write and read from the editor shares: the organization's plan or licence
 * includes quotas. Throws `ResourceNotFoundError` for an organization without billing, and
 * `OperationNotAllowedError` ("Quotas are not enabled") where quotas are not included.
 */
export const checkQuotasEnabled = async (organizationId: string): Promise<void> => {
  // Throws `ResourceNotFoundError` when the organization has no billing row.
  await getOrganizationBilling(organizationId);
  const isQuotasAllowed = await getIsQuotasEnabled(organizationId);
  if (!isQuotasAllowed) {
    throw new OperationNotAllowedError("Quotas are not enabled");
  }
};
