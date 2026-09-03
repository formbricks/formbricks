import "server-only";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";

export const CONTACTS_NOT_ENABLED_MESSAGE = "Contacts are not enabled for this organization";

/**
 * The exact string the v1 management routes have always returned for a missing contacts
 * entitlement — kept verbatim for API consumers that match on it.
 */
export const CONTACTS_API_V1_NOT_ENABLED_MESSAGE =
  "Contacts are only enabled for Enterprise Edition, please upgrade.";

/**
 * Module-boundary guard for the contacts (EE) entitlement, for server actions.
 *
 * Every server action in `modules/ee/contacts` that reads or writes contact data must call this
 * right after authorization. The entitlement check used to be inlined per call site and rotted
 * out of several write paths over time (it survived only in some siblings), so new call sites
 * must go through this helper instead of re-inlining `getIsContactsEnabled`.
 */
export const ensureContactsEnabled = async (organizationId: string): Promise<void> => {
  const isContactsEnabled = await getIsContactsEnabled(organizationId);
  if (!isContactsEnabled) {
    throw new OperationNotAllowedError(CONTACTS_NOT_ENABLED_MESSAGE);
  }
};
