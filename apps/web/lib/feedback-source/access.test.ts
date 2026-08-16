import { beforeEach, describe, expect, test, vi } from "vitest";
import { assertCan } from "@/lib/authorization";
import { assertFeedbackSourceDirectoryAccess } from "./access";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ assertCan: vi.fn() }));

describe("assertFeedbackSourceDirectoryAccess", () => {
  beforeEach(() => {
    vi.mocked(assertCan).mockReset().mockResolvedValue(undefined);
  });

  test.each([
    ["read", "feedbackDirectoryAssignment.read"],
    ["write", "feedbackDirectoryAssignment.write"],
  ] as const)("maps %s access to the exact dataset assignment", async (permission, action) => {
    await assertFeedbackSourceDirectoryAccess("user_1", "directory_1", "workspace_1", permission);

    expect(assertCan).toHaveBeenCalledWith({ type: "user", id: "user_1" }, action, {
      type: "feedbackDirectoryAssignment",
      feedbackDirectoryId: "directory_1",
      workspaceId: "workspace_1",
    });
  });
});
