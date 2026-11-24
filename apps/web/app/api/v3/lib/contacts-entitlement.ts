import "server-only";
import { problemContactsNotEntitled, problemForbidden } from "@/app/api/v3/lib/response";
import {
  CONTACT_DIRECTORY_MISSING_MESSAGE,
  type TWorkspaceContactDirectory,
  getWorkspaceContactDirectory,
} from "@/modules/ee/contacts/lib/contact-directory";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";

/**
 * The enterprise Contacts gate shared by the v3 contact, contact-attribute and segment reads — the same
 * flag the Contacts, Attributes and Segments pages check. Returns a 403 problem to short-circuit with,
 * or null when the organization is entitled. Run it after the workspace check, never before: an
 * unauthorized caller must get the auth answer, not learn the organization's licence state.
 */
export async function assertV3ContactsEnabled(
  organizationId: string,
  requestId: string,
  instance: string
): Promise<Response | null> {
  if (await getIsContactsEnabled(organizationId)) {
    return null;
  }

  return problemContactsNotEntitled(requestId, instance);
}

/**
 * The no-directory gate of the same reads (spec decision 13): a workspace with no contact directory has no
 * contacts, keys or segments to read. Returns a 403 problem carrying the decision 13 message, or the
 * workspace's directory. Like the entitlement, run it after the workspace check: a caller without access
 * must not learn whether the workspace has a directory.
 */
export async function assertV3ContactDirectory(
  workspaceId: string,
  requestId: string,
  instance: string
): Promise<Response | TWorkspaceContactDirectory> {
  const directory = await getWorkspaceContactDirectory(workspaceId);
  if (directory) return directory;

  return problemForbidden(requestId, CONTACT_DIRECTORY_MISSING_MESSAGE, instance);
}
