import "server-only";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import type { TWorkspaceAuth } from "@/modules/workspaces/types/workspace-auth";
import { type TCreativeRecord, findCreativeRecord, findCreativeWorkspaceId } from "./repository";

/**
 * The one place creative access is decided. Creatives are authorized at the workspace level, like
 * dashboards: `read` members view, `readWrite` members edit, and there is no SpiceDB `creative`
 * definition. Every creative check goes through these functions, so a per-creative model later
 * changes this file and no call site.
 *
 * Both answer a `Response` (401 or 403) when access is denied, or the resolved workspace context.
 */

export type TCreativeAccess = "read" | "readWrite";

type TAuthorizeParams = {
  authentication: TV3Authentication;
  access: TCreativeAccess;
  requestId: string;
  instance: string;
};

export type TAuthorizedCreative = V3WorkspaceContext & { creativeId: string };

/** Access to a workspace's creatives as a whole: listing them, or creating one. */
export const authorizeCreativeWorkspace = ({
  workspaceId,
  authentication,
  access,
  requestId,
  instance,
}: TAuthorizeParams & { workspaceId: string }): Promise<Response | V3WorkspaceContext> =>
  requireV3WorkspaceAccess(authentication, workspaceId, access, requestId, instance);

/**
 * Access to one creative, through the workspace it belongs to. The caller never names the workspace, so
 * it can't choose the scope it is checked against. An unknown creative answers the same 403 as one the
 * caller can't see, so creative ids can't be probed for existence. Every later query must be scoped by
 * the returned `{ creativeId, workspaceId }`.
 */
export const authorizeCreative = async ({
  creativeId,
  ...params
}: TAuthorizeParams & { creativeId: string }): Promise<Response | TAuthorizedCreative> => {
  const workspaceId = await findCreativeWorkspaceId(creativeId);
  if (!workspaceId) {
    return problemForbidden(
      params.requestId,
      "You are not authorized to access this resource",
      params.instance
    );
  }

  const context = await authorizeCreativeWorkspace({ ...params, workspaceId });
  return context instanceof Response ? context : { ...context, creativeId };
};

export type TCreativePageAccess = TWorkspaceAuth & { access: TCreativeAccess; record: TCreativeRecord };

/**
 * The same rule for the creative admin pages (summary and editor), for the signed-in member:
 * `getWorkspaceAuth` refuses anyone without access to the workspace, and the creative must belong to
 * it — `null` otherwise, a 404 for the page, so ids can't be probed across workspaces. A member who can
 * only read gets `access: "read"` and sees both pages read-only. The creative is read once, scoped to
 * the workspace, and handed back as `record` for the page to render.
 */
export const authorizeCreativePage = async ({
  workspaceId,
  creativeId,
}: Readonly<{ workspaceId: string; creativeId: string }>): Promise<TCreativePageAccess | null> => {
  const [auth, record] = await Promise.all([
    getWorkspaceAuth(workspaceId),
    findCreativeRecord(creativeId, workspaceId),
  ]);
  if (!record) return null;
  return { ...auth, access: auth.isReadOnly ? "read" : "readWrite", record };
};
