export const WORKSPACE_DELETE_CONFIRMATION_ERROR = "Workspace name confirmation does not match";

const normalizeWorkspaceNameConfirmation = (value: string) => value.trim().toLowerCase();

export const hasMatchingWorkspaceDeleteConfirmation = (
  confirmationName: string,
  workspaceName: string
): boolean => {
  return (
    normalizeWorkspaceNameConfirmation(confirmationName) === normalizeWorkspaceNameConfirmation(workspaceName)
  );
};
