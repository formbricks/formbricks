import "server-only";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import {
  CONTACT_DIRECTORY_MISSING_MESSAGE,
  type TWorkspaceContactDirectory,
  getWorkspaceContactDirectory,
} from "@/modules/ee/contacts/lib/contact-directory";
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

/**
 * The no-directory guard of the same APIs (spec decision 13): a workspace with no contact directory can't
 * hold contacts or attribute keys yet. Run it after the workspace check, so a caller without access never
 * learns whether the workspace has a directory, and before any write. Returns the directory, so the
 * caller doesn't read it again.
 */
export const checkContactDirectoryApiV2 = async (
  workspaceId: string
): Promise<Result<TWorkspaceContactDirectory, ApiErrorResponseV2>> => {
  const directory = await getWorkspaceContactDirectory(workspaceId);
  if (directory) return ok(directory);
  return err({ type: "forbidden", message: CONTACT_DIRECTORY_MISSING_MESSAGE });
};
