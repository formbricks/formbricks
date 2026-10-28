import "server-only";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";

/**
 * The text every gated contacts or segments operation answers with when the organization lacks the
 * Enterprise contacts entitlement. Identical to `GET /api/v3/contact-attribute-keys`, so a client sees one
 * refusal for the whole feature.
 */
export const V3_CONTACTS_NOT_ENABLED_DETAIL = "The contacts feature is not enabled for this organization.";

/**
 * Workspace access first, entitlement second. The order matters: the entitlement answer is only given to a
 * caller who already holds the permission, so it reveals nothing about a workspace the caller cannot see.
 * `minPermission` is `read` for reads and `readWrite` for mutations, the levels the UI actions asked for
 * (`workspace.read` / `workspace.write`).
 */
export async function requireV3ContactsAccess(params: {
  authentication: TV3Authentication;
  workspaceId: string;
  minPermission: "read" | "readWrite";
  requestId: string;
  instance: string;
}): Promise<Response | V3WorkspaceContext> {
  const { authentication, workspaceId, minPermission, requestId, instance } = params;

  const access = await requireV3WorkspaceAccess(
    authentication,
    workspaceId,
    minPermission,
    requestId,
    instance
  );
  if (access instanceof Response) return access;

  if (!(await getIsContactsEnabled(access.organizationId))) {
    return problemForbidden(requestId, V3_CONTACTS_NOT_ENABLED_DETAIL, instance);
  }

  return access;
}
