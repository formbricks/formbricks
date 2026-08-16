import { describe, expect, test } from "vitest";
import {
  getFeedbackDirectoryActionForPermission,
  getFeedbackDirectoryAssignmentActionForPermission,
} from "./compatibility";

describe("feedback directory action compatibility", () => {
  test.each([
    ["read", "feedbackDirectory.read"],
    ["write", "feedbackDirectory.write"],
    ["manage", "feedbackDirectory.manage"],
  ] as const)("maps directory %s to the central vocabulary", (permission, action) => {
    expect(getFeedbackDirectoryActionForPermission(permission)).toBe(action);
  });

  test.each([
    [undefined, "feedbackDirectoryAssignment.read"],
    ["read", "feedbackDirectoryAssignment.read"],
    ["readWrite", "feedbackDirectoryAssignment.write"],
    ["manage", "feedbackDirectoryAssignment.manage"],
  ] as const)("maps assignment %s to the central vocabulary", (permission, action) => {
    expect(getFeedbackDirectoryAssignmentActionForPermission(permission)).toBe(action);
  });
});
