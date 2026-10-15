import "server-only";
import { type TOrgAction, requireOrgActionAccess } from "@/app/api/internal/lib/organization-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import { getIsDataRetentionEnabled } from "@/modules/ee/license-check/lib/utils";

/** What a data retention route asks of the caller: `read_access` to read, `manage` to change (and read History). */
export type TRetentionOrgAction = TOrgAction;

export const RETENTION_NOT_ENABLED_DETAIL =
  "Data retention is not enabled for this organization. It requires an Enterprise plan or license.";

/**
 * Authorize a data retention request against one organization (ENG-3695): `requireOrgActionAccess`,
 * then the data retention licence.
 *
 * Authorization comes before the licence check, so a non-member never learns whether the organization
 * holds the entitlement.
 */
export async function requireRetentionOrgAccess(
  params: Parameters<typeof requireOrgActionAccess>[0]
): Promise<Response | { organizationId: string; userId: string }> {
  const access = await requireOrgActionAccess(params);
  if (access instanceof Response) return access;

  if (!(await getIsDataRetentionEnabled(access.organizationId))) {
    return problemForbidden(params.requestId, RETENTION_NOT_ENABLED_DETAIL, params.instance);
  }

  return access;
}
