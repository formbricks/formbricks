import "server-only";
import { getIsFeedbackDirectoriesEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TTeamPermission } from "@/modules/ee/teams/workspace-teams/types/team";
import { requireV3WorkspaceAccess } from "./auth";
import { problemForbidden } from "./response";
import type { TV3Authentication } from "./types";
import type { V3WorkspaceContext } from "./workspace-context";

/**
 * Workspace access + the `feedbackDirectories` entitlement — the gate every Unify Feedback surface needs
 * before touching Hub data. `requireV3WorkspaceAccess` covers org owner/manager OR workspace-team
 * permission; this adds the entitlement check it deliberately does not do.
 *
 * Shared so the pair can't drift between the v3 surfaces that depend on it (taxonomy and feedback
 * records). Callers that also address a specific directory should use `requireUnifyDirectoryAccess`,
 * which layers the membership check on top.
 *
 * Returns a `Response` (401/403) to short-circuit on failure, or the resolved workspace context.
 */
export async function requireUnifyFeedbackWorkspaceAccess(
  authentication: TV3Authentication,
  workspaceId: string,
  minPermission: TTeamPermission,
  requestId: string,
  instance?: string
): Promise<Response | V3WorkspaceContext> {
  const context = await requireV3WorkspaceAccess(
    authentication,
    workspaceId,
    minPermission,
    requestId,
    instance
  );
  if (context instanceof Response) {
    return context;
  }

  if (!(await getIsFeedbackDirectoriesEnabled(context.organizationId))) {
    // Keeps the recognizable leading phrase used elsewhere, plus a next step — an API or MCP caller has
    // no upgrade prompt to fall back on, so the response has to say who can act.
    return problemForbidden(
      requestId,
      "Unify Feedback is not enabled for this organization. It requires an Enterprise plan or license — an organization owner can enable it from the organization's billing or license settings.",
      instance
    );
  }

  return context;
}
