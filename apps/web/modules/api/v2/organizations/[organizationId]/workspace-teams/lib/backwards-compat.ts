import { type WorkspaceTeam } from "@prisma/client";

/**
 * Backwards compatibility layer for the project-teams → workspace-teams API rename.
 *
 * Old API consumers may send `projectId` instead of `workspaceId` in request bodies/queries.
 * These utilities normalise the input to the new field name and, when needed, map the
 * response back to include the legacy `projectId` field so existing integrations keep working.
 */

// ---------------------------------------------------------------------------
// Input transformation: accept `projectId` as an alias for `workspaceId`
// ---------------------------------------------------------------------------

/**
 * Normalise a request body or query object so that `projectId` is mapped to `workspaceId`.
 * If both are provided, `workspaceId` takes precedence.
 */
export const normaliseProjectIdToWorkspaceId = <T extends Record<string, unknown>>(input: T): T => {
  if ("projectId" in input && !("workspaceId" in input)) {
    const { projectId, ...rest } = input;
    return { ...rest, workspaceId: projectId } as unknown as T;
  }

  // Drop stale projectId if workspaceId is already present
  if ("projectId" in input && "workspaceId" in input) {
    const { projectId: _, ...rest } = input;
    return rest as unknown as T;
  }

  return input;
};

// ---------------------------------------------------------------------------
// Output transformation: include legacy `projectId` alongside `workspaceId`
// ---------------------------------------------------------------------------

type WorkspaceTeamWithLegacy = WorkspaceTeam & { projectId: string };

export const addLegacyProjectId = (wt: WorkspaceTeam): WorkspaceTeamWithLegacy => ({
  ...wt,
  projectId: wt.workspaceId,
});

export const addLegacyProjectIdToList = (wts: WorkspaceTeam[]): WorkspaceTeamWithLegacy[] =>
  wts.map(addLegacyProjectId);
