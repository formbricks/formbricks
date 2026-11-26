import "server-only";
import { requireActionAccess } from "@/app/api/internal/lib/action-access";
import type { TV3Authentication } from "@/app/api/v3/lib/types";

/** What an internal route asks of the caller on a workspace, in the app's authorization vocabulary. */
export type TWorkspaceAction = "workspace.read" | "workspace.write";

/**
 * Authorize a request against one workspace the route has already resolved: a session user who may take
 * `action` on it, as the server actions these routes replace asked with `assertCan`. Unlike
 * `requireSessionWorkspaceAccess`, it reads nothing first, so a route that knows the workspace makes no
 * extra query. The resolver denies an unknown id too, so a missing workspace and one the caller can't
 * reach answer the same 403.
 */
export async function requireWorkspaceActionAccess({
  authentication,
  workspaceId,
  action,
  requestId,
  instance,
}: {
  authentication: TV3Authentication;
  workspaceId: string;
  action: TWorkspaceAction;
  requestId: string;
  instance?: string;
}): Promise<Response | { userId: string }> {
  return requireActionAccess({
    authentication,
    action,
    resource: { type: "workspace", id: workspaceId },
    requestId,
    instance,
  });
}
