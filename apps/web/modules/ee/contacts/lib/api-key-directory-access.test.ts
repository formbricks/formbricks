import { beforeEach, describe, expect, test, vi } from "vitest";
import { can } from "@/lib/authorization";
import { findApiKeyWorkspaceOnDirectory } from "./api-key-directory-access";
import { getWorkspacesOnDirectory } from "./contact-directory";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("./contact-directory", () => ({ getWorkspacesOnDirectory: vi.fn() }));

describe("findApiKeyWorkspaceOnDirectory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the first of the key's workspaces on the directory that it may act on", async () => {
    vi.mocked(getWorkspacesOnDirectory).mockResolvedValue(["ws-a", "ws-b"]);
    // Read-only on A, manage on B: a delete goes through B.
    vi.mocked(can).mockImplementation(
      async (_actor, _action, resource) => "id" in resource && resource.id === "ws-b"
    );

    await expect(
      findApiKeyWorkspaceOnDirectory("key-1", "workspace.manage", "dir-1", ["ws-b", "ws-a", "ws-x"])
    ).resolves.toBe("ws-b");
    expect(getWorkspacesOnDirectory).toHaveBeenCalledWith("dir-1", ["ws-b", "ws-a", "ws-x"]);
    expect(can).toHaveBeenCalledWith({ type: "apiKey", id: "key-1" }, "workspace.manage", {
      type: "workspace",
      id: "ws-a",
    });
  });

  test("returns null when the key reaches no workspace on the directory", async () => {
    vi.mocked(getWorkspacesOnDirectory).mockResolvedValue([]);

    await expect(
      findApiKeyWorkspaceOnDirectory("key-1", "workspace.read", "dir-other", ["ws-a"])
    ).resolves.toBeNull();
    expect(can).not.toHaveBeenCalled();
  });

  test("returns null when the key may not act on any of them", async () => {
    vi.mocked(getWorkspacesOnDirectory).mockResolvedValue(["ws-a"]);
    vi.mocked(can).mockResolvedValue(false);

    await expect(
      findApiKeyWorkspaceOnDirectory("key-1", "workspace.write", "dir-1", ["ws-a"])
    ).resolves.toBeNull();
  });

  test("returns null for a row with no directory", async () => {
    await expect(
      findApiKeyWorkspaceOnDirectory("key-1", "workspace.read", null, ["ws-a"])
    ).resolves.toBeNull();
    expect(getWorkspacesOnDirectory).not.toHaveBeenCalled();
  });
});
