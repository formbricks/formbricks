import "server-only";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { problemForbidden, problemUnauthorized } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { can } from "@/lib/authorization";
import { getOrganizationIdFromDirectoryId } from "@/modules/ee/feedback-directory/lib/feedback-directory";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";

/**
 * Authorize a request that mutates a feedback dataset as a whole.
 *
 * A dataset is an organization-level resource: it is owned by an organization and shared with any
 * number of workspaces (possibly none). So the guard is org-scoped rather than workspace-scoped —
 * the sibling taxonomy guard reaches datasets *through* a workspace, which cannot address a dataset
 * that has no workspace assigned, and a dataset with no workspaces is exactly one you might want to
 * empty.
 *
 * The dataset id is never trusted as a claim about who owns it. The organization is *derived* from
 * the dataset, and the caller's role is then checked against that organization, so a caller cannot
 * reach another organization's dataset by supplying its id.
 *
 * Owner/manager only, for the ENG-1770 reason: a dataset's records carry no workspace of their own,
 * so workspace permissions cannot draw a line between them — a member of one workspace would
 * otherwise destroy records another workspace's surveys ingested.
 *
 * Returns a `Response` (401/403) to short-circuit on failure, or the organization id on success.
 * Never 404: a caller who cannot reach the dataset must not learn whether it exists.
 */
export async function requireFeedbackDatasetMutationAccess(
  authentication: TV3Authentication,
  datasetId: string,
  requestId: string,
  instance?: string
): Promise<Response | { organizationId: string }> {
  const userId = getSessionUserId(authentication);
  if (!userId) {
    return problemUnauthorized(requestId, "Session required", instance);
  }

  // One response for "no such dataset" and "not yours": a caller who is not an owner/manager of the
  // owning organization must not be able to tell the two apart, or the endpoint becomes an oracle
  // for whether a given dataset id exists. Mirrors the sibling taxonomy guard, and follows
  // problemNotFound's own guidance against using it on existence-sensitive resources.
  const denied = problemForbidden(requestId, "You are not authorized to access this resource", instance);

  let organizationId: string;
  try {
    organizationId = await getOrganizationIdFromDirectoryId(datasetId);
  } catch (err) {
    if (err instanceof ResourceNotFoundError) {
      return denied;
    }
    throw err;
  }

  // Authorization before entitlement, so a non-member never learns anything about the owning
  // organization — including whether it holds an Enterprise license.
  if (
    !(await can({ type: "user", id: userId }, "organization.manage", {
      type: "organization",
      id: organizationId,
    }))
  ) {
    return denied;
  }

  if (!(await getIsFeedbackDirectoriesEnabled(organizationId))) {
    return problemForbidden(
      requestId,
      "Feedback datasets are not enabled for this organization. It requires an Enterprise plan or license.",
      instance
    );
  }

  return { organizationId };
}

/** Extract the session user id. Present because this route is session-auth. */
export function getSessionUserId(authentication: TV3Authentication): string | null {
  if (authentication && "user" in authentication && authentication.user?.id) {
    return authentication.user.id;
  }
  return null;
}
