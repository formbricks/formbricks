import "server-only";
import { requireUnifyFeedbackWorkspaceAccess } from "@/app/api/v3/lib/feedback-access";
import { problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { getFeedbackDirectoriesByWorkspaceId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
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

  const directories = await getFeedbackDirectoriesByWorkspaceId(context.workspaceId);
  if (!directories.some((directory) => directory.id === directoryId)) {
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
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
