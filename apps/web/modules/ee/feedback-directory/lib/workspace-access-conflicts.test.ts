import { describe, expect, test } from "vitest";
import {
  getWorkspaceConflictDetails,
  hasSelectableWorkspace,
  shouldShowWorkspaceAccessBlockedExplanation,
} from "./workspace-access-conflicts";

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

    expect(getWorkspaceConflictDetails(input)).toEqual([
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
    ]);
    expect(hasSelectableWorkspace(input)).toBe(false);
    expect(shouldShowWorkspaceAccessBlockedExplanation(input)).toBe(true);
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

    expect(getWorkspaceConflictDetails(input)).toEqual([
      {
        workspaceId: "workspace-a",
        workspaceName: "Alpha",
        feedbackDirectoryName: "Directory A",
      },
    ]);
    expect(hasSelectableWorkspace(input)).toBe(true);
    expect(shouldShowWorkspaceAccessBlockedExplanation(input)).toBe(false);
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

    expect(getWorkspaceConflictDetails(input)).toEqual([
      {
        workspaceId: "workspace-b",
        workspaceName: "Beta",
        feedbackDirectoryName: "Directory B",
      },
    ]);
    expect(hasSelectableWorkspace(input)).toBe(true);
    expect(shouldShowWorkspaceAccessBlockedExplanation(input)).toBe(false);
  });
});
