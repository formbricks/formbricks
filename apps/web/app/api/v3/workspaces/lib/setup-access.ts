import "server-only";
import { getV3AuthorizationActor, requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { type TAuthorizationActor, can } from "@/lib/authorization";

export const WORKSPACE_SETUP_PERMISSION_MESSAGE =
  "Only organization owners and managers can change workspace setup. API keys need manage access to the workspace.";

/**
 * Workspace setup (name, channel, branding) shapes every survey in the workspace, so it is narrower than
 * writing a survey: organization owners and managers for a signed-in user, and a `manage` grant on that
 * workspace for an API key. `organizationId` is the workspace's own, resolved server-side.
 */
const canManageWorkspaceSetup = async (
  actor: TAuthorizationActor,
  workspace: Readonly<{ workspaceId: string; organizationId: string }>
): Promise<boolean> =>
  actor.type === "user"
    ? can(actor, "organization.manage", { type: "organization", id: workspace.organizationId })
    : can(actor, "workspace.manage", { type: "workspace", id: workspace.workspaceId });

/**
 * Read access first, so a workspace the caller cannot reach answers exactly like any other v3 resource,
 * then the setup-write role check. Returns the resolved workspace context or the `Response` to relay.
 */
export async function requireV3WorkspaceSetupAccess(
  authentication: TV3Authentication,
  workspaceId: string,
  requestId: string,
  instance: string
): Promise<Response | V3WorkspaceContext> {
  const context = await requireV3WorkspaceAccess(authentication, workspaceId, "read", requestId, instance);
  if (context instanceof Response) {
    return context;
  }

  const actor = getV3AuthorizationActor(authentication);
  if (!actor || !(await canManageWorkspaceSetup(actor, context))) {
    return problemForbidden(requestId, WORKSPACE_SETUP_PERMISSION_MESSAGE, instance);
  }

  return context;
}
