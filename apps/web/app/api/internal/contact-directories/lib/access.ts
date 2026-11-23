import "server-only";
import { requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import { problemContactsNotEntitled, problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getContactDirectoryOrganizationId } from "@/modules/ee/contacts/directories/lib/directory-service";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";

type TAccessParams = {
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
};

/**
 * Owners and managers of the organization (`organization.manage`), for reads as well as writes: the list
 * shows every workspace's directory and contact count, which a member of one workspace should not see.
 * Authorization comes before the Contacts licence check, so a non-member never learns whether the
 * organization holds it.
 */
export async function requireContactDirectoryOrgAccess({
  organizationId,
  ...params
}: TAccessParams & { organizationId: string }): Promise<
  Response | { organizationId: string; userId: string }
> {
  const access = await requireOrgActionAccess({ ...params, organizationId, action: "organization.manage" });
  if (access instanceof Response) return access;

  if (!(await getIsContactsEnabled(access.organizationId))) {
    return problemContactsNotEntitled(params.requestId, params.instance);
  }

  return access;
}

/**
 * The same check for a route addressed by directory id. The organization is derived from the directory,
 * never taken from the caller, and an unknown directory answers the same 403 as one the caller can't
 * manage, so the route can't be used to probe which directory ids exist.
 */
export async function requireContactDirectoryAccess({
  directoryId,
  ...params
}: TAccessParams & { directoryId: string }): Promise<Response | { organizationId: string; userId: string }> {
  const organizationId = await getContactDirectoryOrganizationId(directoryId);
  if (!organizationId) return problemForbidden(params.requestId, undefined, params.instance);

  return requireContactDirectoryOrgAccess({ ...params, organizationId });
}
