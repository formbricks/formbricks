import { describe, expect, test } from "vitest";
import { getWorkspaceAccessConflictState } from "./workspace-access-conflicts";

const orgWorkspaces = [
  { id: "workspace-b", name: "Beta" },
  { id: "workspace-a", name: "Alpha" },
];

describe("workspace access conflict helpers", () => {
  test("shows conflicts when every workspace is assigned to a different active directory", () => {
    const input = {
      orgWorkspaces,
      workspaceAccessByWorkspace: [
        {
          workspaceId: "workspace-b",
          feedbackDirectoryId: "directory-2",
          feedbackDirectoryName: "Directory B",
        },
        {
          workspaceId: "workspace-a",
          feedbackDirectoryId: "directory-1",
          feedbackDirectoryName: "Directory A",
        },
      ],
      currentDirectoryId: "directory-current",
    };

    expect(getWorkspaceAccessConflictState(input)).toEqual({
      conflictDetails: [
        {
          workspaceId: "workspace-a",
          workspaceName: "Alpha",
          feedbackDirectoryName: "Directory A",
        },
        {
          workspaceId: "workspace-b",
          workspaceName: "Beta",
          feedbackDirectoryName: "Directory B",
        },
      ],
      hasSelectableWorkspace: false,
      showBlockedExplanation: true,
    });
  });

  test("does not show the blocked explanation when some workspaces are still available", () => {
    const input = {
      orgWorkspaces,
      workspaceAccessByWorkspace: [
        {
          workspaceId: "workspace-a",
          feedbackDirectoryId: "directory-1",
          feedbackDirectoryName: "Directory A",
        },
      ],
      currentDirectoryId: "directory-current",
    };

    expect(getWorkspaceAccessConflictState(input)).toEqual({
      conflictDetails: [
        {
          workspaceId: "workspace-a",
          workspaceName: "Alpha",
          feedbackDirectoryName: "Directory A",
        },
      ],
      hasSelectableWorkspace: true,
      showBlockedExplanation: false,
    });
  });

  test("treats assignments to the current directory as selectable", () => {
    const input = {
      orgWorkspaces,
      workspaceAccessByWorkspace: [
        {
          workspaceId: "workspace-a",
          feedbackDirectoryId: "directory-current",
          feedbackDirectoryName: "Current Directory",
        },
        {
          workspaceId: "workspace-b",
          feedbackDirectoryId: "directory-2",
          feedbackDirectoryName: "Directory B",
        },
      ],
      currentDirectoryId: "directory-current",
    };

    expect(getWorkspaceAccessConflictState(input)).toEqual({
      conflictDetails: [
        {
          workspaceId: "workspace-b",
          workspaceName: "Beta",
          feedbackDirectoryName: "Directory B",
        },
      ],
      hasSelectableWorkspace: true,
      showBlockedExplanation: false,
    });
  });
});
