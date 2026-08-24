import "server-only";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";

/**
 * Contacts entitlement guard for the v2/v3-flavored management APIs: returns the `forbidden`
 * error object for `handleApiError` when the entitlement is missing, `null` when the caller may
 * proceed.
 *
 * Lives in license-check (not `modules/ee/contacts`) because the v2 attribute-key routes under
 * the OSS `modules/api/v2` path consume it, and license-check is the sanctioned import boundary
 * for OSS code. The server-action flavour (`ensureContactsEnabled`) stays in
 * `modules/ee/contacts/lib/contacts-entitlement.ts`, which only EE code imports.
 */
export const checkContactsEnabledApiV2 = async (
  organizationId: string
): Promise<ApiErrorResponseV2 | null> => {
  const isContactsEnabled = await getIsContactsEnabled(organizationId);
  if (isContactsEnabled) {
    return null;
  }
  return {
    type: "forbidden",
    details: [{ field: "contacts", issue: "Contacts feature is not enabled for this organization" }],
  };
};
