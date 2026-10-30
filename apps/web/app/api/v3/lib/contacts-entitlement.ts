import "server-only";
import { problemForbidden } from "@/app/api/v3/lib/response";
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

  return problemForbidden(requestId, "The contacts feature is not enabled for this organization.", instance);
}
