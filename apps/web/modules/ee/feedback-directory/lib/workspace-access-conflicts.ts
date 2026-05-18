interface WorkspaceAccessAssignment {
  workspaceId: string;
  feedbackDirectoryId: string;
  feedbackDirectoryName: string;
}

interface WorkspaceOptionSource {
  id: string;
  name: string;
}

export interface WorkspaceConflictDetail {
  workspaceId: string;
  workspaceName: string;
  feedbackDirectoryName: string;
}

interface WorkspaceConflictInput {
  orgWorkspaces: WorkspaceOptionSource[];
  workspaceAccessByWorkspace: WorkspaceAccessAssignment[];
  currentDirectoryId?: string;
}

const sortByWorkspaceName = (a: WorkspaceConflictDetail, b: WorkspaceConflictDetail): number =>
  a.workspaceName.localeCompare(b.workspaceName, undefined, { sensitivity: "base" });

export const getWorkspaceConflictDetails = ({
  orgWorkspaces,
  workspaceAccessByWorkspace,
  currentDirectoryId,
}: WorkspaceConflictInput): WorkspaceConflictDetail[] => {
  const workspaceAccessMap = new Map(
    workspaceAccessByWorkspace.map((assignment) => [assignment.workspaceId, assignment])
  );

  return orgWorkspaces
    .flatMap((workspace) => {
      const assignment = workspaceAccessMap.get(workspace.id);
      if (!assignment || assignment.feedbackDirectoryId === currentDirectoryId) {
        return [];
      }

      return [
        {
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          feedbackDirectoryName: assignment.feedbackDirectoryName,
        },
      ];
    })
    .sort(sortByWorkspaceName);
};

export const hasSelectableWorkspace = ({
  orgWorkspaces,
  workspaceAccessByWorkspace,
  currentDirectoryId,
}: WorkspaceConflictInput): boolean => {
  const workspaceAccessMap = new Map(
    workspaceAccessByWorkspace.map((assignment) => [assignment.workspaceId, assignment])
  );

  return orgWorkspaces.some((workspace) => {
    const assignment = workspaceAccessMap.get(workspace.id);
    return !assignment || assignment.feedbackDirectoryId === currentDirectoryId;
  });
};

export const shouldShowWorkspaceAccessBlockedExplanation = (input: WorkspaceConflictInput): boolean =>
  getWorkspaceConflictDetails(input).length > 0 && !hasSelectableWorkspace(input);
