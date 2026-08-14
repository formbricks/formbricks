import "server-only";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { requireUnifyFeedbackWorkspaceAccess } from "@/app/api/v3/lib/feedback-access";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { can } from "@/lib/authorization";
import { getFeedbackDirectoryAssignmentActionForPermission } from "@/lib/authorization/compatibility";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";

/**
 * Authorize a Unify Feedback taxonomy request against a workspace + feedback directory.
 *
 * Reproduces the exact guard the legacy server actions applied (`ensureAccess` + `ensureDirectoryAccess`):
 * the shared `requireUnifyFeedbackWorkspaceAccess` covers workspace permission plus the
 * `feedbackDirectories` entitlement, and this wrapper adds the directory-belongs-to-workspace membership
 * check. Omitting either would widen access beyond today.
 *
 * Returns a `Response` (401/403) to short-circuit on failure, or the resolved workspace context on success.
 */
export async function requireUnifyDirectoryAccess(
  authentication: TV3Authentication,
  workspaceId: string,
  directoryId: string,
  minPermission: TTeamPermission,
  requestId: string,
  instance?: string
): Promise<Response | V3WorkspaceContext> {
  const context = await requireUnifyFeedbackWorkspaceAccess(
    authentication,
    workspaceId,
    minPermission,
    requestId,
    instance
  );
  if (context instanceof Response) {
    return context;
  }

  const actor = getV3AuthorizationActor(authentication);
  if (!actor) {
    return problemUnauthorized(requestId, "Not authenticated", instance);
  }

  const allowed = await can(actor, getFeedbackDirectoryAssignmentActionForPermission(minPermission), {
    type: "feedbackDirectoryAssignment",
    id: directoryId,
    workspaceId: context.workspaceId,
  });
  if (!allowed) {
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }

  return context;
}

/**
 * Authorize a request that *changes* directory-level taxonomy state (start a run, rename or remove a
 * node) — organization owners and managers only (ENG-1770).
 *
 * A feedback directory is shared by every workspace it is assigned to, and it has one taxonomy tree:
 * a workspace `readWrite` member would otherwise rewrite or delete topics that other workspaces read.
 * Since taxonomy state carries no workspace, workspace permissions cannot draw that line, so changing
 * it stays with the roles that own org-level data.
 *
 * Workspace access is still required on top of the org role, so the directory-belongs-to-workspace
 * check still applies and an owner cannot reach a directory through an unrelated workspace.
 */
export async function requireUnifyDirectoryMutationAccess(
  authentication: TV3Authentication,
  workspaceId: string,
  directoryId: string,
  requestId: string,
  instance?: string
): Promise<Response | V3WorkspaceContext> {
  const context = await requireUnifyDirectoryAccess(
    authentication,
    workspaceId,
    directoryId,
    "read",
    requestId,
    instance
  );
  if (context instanceof Response) {
    return context;
  }

  const userId = getSessionUserId(authentication);
  if (!userId) {
    return problemUnauthorized(requestId, "Session required", instance);
  }

  const allowed = await can({ type: "user", id: userId }, "organization.manage", {
    type: "organization",
    id: context.organizationId,
  });
  if (!allowed) {
    return problemForbidden(
      requestId,
      "Only organization owners and managers can change a feedback directory's taxonomy",
      instance
    );
  }

  return context;
}

/** Extract the session user id (used as Hub `actor_id`). Present because these routes are session-auth. */
export function getSessionUserId(authentication: TV3Authentication): string | null {
  if (authentication && "user" in authentication && authentication.user?.id) {
    return authentication.user.id;
  }
  return null;
}
