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

interface WorkspaceAccessConflictInput {
  orgWorkspaces: WorkspaceOptionSource[];
  workspaceAccessByWorkspace: WorkspaceAccessAssignment[];
  currentDirectoryId?: string;
}

interface WorkspaceAccessConflictState {
  conflictDetails: WorkspaceConflictDetail[];
  hasSelectableWorkspace: boolean;
  showBlockedExplanation: boolean;
}

const sortByWorkspaceName = (a: WorkspaceConflictDetail, b: WorkspaceConflictDetail): number =>
  a.workspaceName.localeCompare(b.workspaceName, undefined, { sensitivity: "base" });

export const getWorkspaceAccessConflictState = ({
  orgWorkspaces,
  workspaceAccessByWorkspace,
  currentDirectoryId,
}: WorkspaceAccessConflictInput): WorkspaceAccessConflictState => {
  const workspaceAccessMap = new Map(
    workspaceAccessByWorkspace.map((assignment) => [assignment.workspaceId, assignment])
  );
  let hasSelectableWorkspace = false;
  const conflictDetails: WorkspaceConflictDetail[] = [];

  for (const workspace of orgWorkspaces) {
    const assignment = workspaceAccessMap.get(workspace.id);
    if (!assignment || assignment.feedbackDirectoryId === currentDirectoryId) {
      hasSelectableWorkspace = true;
      continue;
    }

    conflictDetails.push({
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      feedbackDirectoryName: assignment.feedbackDirectoryName,
    });
  }

  conflictDetails.sort(sortByWorkspaceName);

  return {
    conflictDetails,
    hasSelectableWorkspace,
    showBlockedExplanation: conflictDetails.length > 0 && !hasSelectableWorkspace,
  };
};
