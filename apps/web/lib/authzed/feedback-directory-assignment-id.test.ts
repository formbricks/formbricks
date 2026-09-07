import { describe, expect, test, vi } from "vitest";
import { getFeedbackDirectoryAssignmentObjectId } from "./feedback-directory-assignment-id";

vi.mock("node:crypto", async (importOriginal) => importOriginal());

describe("getFeedbackDirectoryAssignmentObjectId", () => {
  test("is deterministic, opaque, and uses the reserved prefix", () => {
    const first = getFeedbackDirectoryAssignmentObjectId("directory-1", "workspace-1");
    const second = getFeedbackDirectoryAssignmentObjectId("directory-1", "workspace-1");

    expect(first).toBe(second);
    expect(first).toMatch(/^fdwa_[a-f0-9]{64}$/);
    expect(first).not.toContain("directory-1");
    expect(first).not.toContain("workspace-1");
  });

  test("is order-sensitive", () => {
    expect(getFeedbackDirectoryAssignmentObjectId("directory", "workspace")).not.toBe(
      getFeedbackDirectoryAssignmentObjectId("workspace", "directory")
    );
  });

  test("length framing distinguishes concatenation collisions", () => {
    expect(getFeedbackDirectoryAssignmentObjectId("ab", "c")).not.toBe(
      getFeedbackDirectoryAssignmentObjectId("a", "bc")
    );
  });

  test("uses UTF-8 byte framing consistently", () => {
    expect(getFeedbackDirectoryAssignmentObjectId("é", "a")).not.toBe(
      getFeedbackDirectoryAssignmentObjectId("e", "́a")
    );
  });
});
