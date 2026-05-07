import { describe, expect, test } from "vitest";
import { hasMatchingWorkspaceDeleteConfirmation } from "./delete-project-confirmation";

describe("workspace delete confirmation", () => {
  test("accepts an exact workspace name match", () => {
    expect(hasMatchingWorkspaceDeleteConfirmation("Acme Workspace", "Acme Workspace")).toBe(true);
  });

  test("accepts different casing", () => {
    expect(hasMatchingWorkspaceDeleteConfirmation("acme workspace", "Acme Workspace")).toBe(true);
  });

  test("accepts leading and trailing whitespace", () => {
    expect(hasMatchingWorkspaceDeleteConfirmation("  Acme Workspace  ", "Acme Workspace")).toBe(true);
  });

  test("rejects an empty confirmation", () => {
    expect(hasMatchingWorkspaceDeleteConfirmation("", "Acme Workspace")).toBe(false);
  });

  test("rejects mismatched confirmations", () => {
    expect(hasMatchingWorkspaceDeleteConfirmation("Other Workspace", "Acme Workspace")).toBe(false);
  });
});
