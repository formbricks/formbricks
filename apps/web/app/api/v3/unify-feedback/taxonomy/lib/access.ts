import "server-only";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import { requireUnifyFeedbackWorkspaceAccess } from "@/app/api/v3/lib/feedback-access";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import type { V3WorkspaceContext } from "@/app/api/v3/lib/workspace-context";
import { can } from "@/lib/authorization";
import { getFeedbackDirectoryAssignmentAuthorizationAction } from "@/lib/authorization/permission-action";
import { getFeedbackDirectoryAuthContext } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { canApiKeyMutateFeedbackDirectoryRecords } from "@/modules/hub/feedback-records-gateway-authz";

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

  const allowed = await can(actor, getFeedbackDirectoryAssignmentAuthorizationAction(minPermission), {
    type: "feedbackDirectoryAssignment",
    feedbackDirectoryId: directoryId,
    workspaceId: context.workspaceId,
  });
  if (!allowed) {
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }

  return context;
}

/**
 * Authorize a request that *changes* directory-level taxonomy state (start a run, rename or remove a
 * node).
 *
 * A feedback directory is shared by every workspace it is assigned to, and it has one taxonomy tree:
 * a workspace `readWrite` member would otherwise rewrite or delete topics that other workspaces read.
 * Since taxonomy state carries no workspace, workspace permissions cannot draw that line, so each
 * principal type gets the closest rule available to it, exactly as for feedback record mutations:
 *
 * - a person (session or OAuth): organization owners and managers only (ENG-1770);
 * - an API key, which has no organization role: write access to the workspace, and a directory that
 *   belongs to that workspace alone (ENG-2189), so no other workspace's topics can be touched.
 *
 * Workspace access is still required on top, so the directory-belongs-to-workspace check applies and an
 * owner cannot reach a directory through an unrelated workspace. An allowlist, not "no user id means
 * allowed": a principal that is neither shape is refused.
 */
export async function requireUnifyDirectoryMutationAccess(
  authentication: TV3Authentication,
  workspaceId: string,
  directoryId: string,
  requestId: string,
  instance?: string
): Promise<Response | V3WorkspaceContext> {
  if (authentication && "apiKeyId" in authentication) {
    return requireApiKeyDirectoryMutationAccess(
      authentication,
      workspaceId,
      directoryId,
      requestId,
      instance
    );
  }

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

/**
 * The API-key half of `requireUnifyDirectoryMutationAccess`: `readWrite` on the workspace plus a
 * directory this key's workspace owns alone.
 *
 * Each comparison is made directly against the directory rather than inherited from the resolver, so the
 * decision stays correct read on its own. Only the sharing refusal carries its own message: an archived,
 * foreign or unresolvable directory is not a sharing problem, and the generic 403 keeps those cases
 * indistinguishable.
 */
async function requireApiKeyDirectoryMutationAccess(
  authentication: TAuthenticationApiKey,
  workspaceId: string,
  directoryId: string,
  requestId: string,
  instance?: string
): Promise<Response | V3WorkspaceContext> {
  const context = await requireUnifyDirectoryAccess(
    authentication,
    workspaceId,
    directoryId,
    "readWrite",
    requestId,
    instance
  );
  if (context instanceof Response) {
    return context;
  }

  const directory = await getFeedbackDirectoryAuthContext(directoryId);
  if (!directory || directory.isArchived || directory.organizationId !== authentication.organizationId) {
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }

  if (!canApiKeyMutateFeedbackDirectoryRecords(directory.workspaceIds)) {
    return problemForbidden(
      requestId,
      "An API key cannot change the topics of a feedback dataset that is shared by more than one workspace. The topic tree belongs to the dataset, not to a workspace, so a workspace-scoped key cannot be shown to own it. Reading topics is unaffected. To change them, authenticate as an organization owner or manager, or assign this dataset to a single workspace under Settings → Organization → Feedback Datasets.",
      instance
    );
  }

  // Counting to one says the directory is unshared, not that the one workspace is the caller's.
  if (directory.workspaceIds[0] !== context.workspaceId) {
    return problemForbidden(requestId, "You are not authorized to access this resource", instance);
  }

  return context;
}

/** Extract the session user id. Absent for an API key, whose actor is `getTaxonomyActorId`. */
export function getSessionUserId(authentication: TV3Authentication): string | null {
  if (authentication && "user" in authentication && authentication.user?.id) {
    return authentication.user.id;
  }
  return null;
}

/**
 * Who the Hub records as `actor_id` on a run, rename or removal: the person's user id, or `apiKey:<id>`
 * for an API key so an agent's change is never mistaken for a person's.
 */
export function getTaxonomyActorId(authentication: TV3Authentication): string | null {
  const userId = getSessionUserId(authentication);
  if (userId) return userId;
  if (authentication && "apiKeyId" in authentication && authentication.apiKeyId) {
    return `apiKey:${authentication.apiKeyId}`;
  }
  return null;
}
