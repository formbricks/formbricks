import { describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getWorkspace } from "@/lib/workspace/service";
import { resolveV3WorkspaceContext } from "./workspace-context";

vi.mock("@/lib/workspace/service", () => ({
  getWorkspace: vi.fn(),
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn(),
}));

describe("resolveV3WorkspaceContext", () => {
  test("returns workspaceId and organizationId when workspace exists", async () => {
    vi.mocked(getWorkspace).mockResolvedValueOnce({ id: "ws_abc" });
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValueOnce("org_123");
    const result = await resolveV3WorkspaceContext("ws_abc");
    expect(result).toEqual({
      workspaceId: "ws_abc",
      organizationId: "org_123",
    });
    expect(getWorkspace).toHaveBeenCalledWith("ws_abc");
    expect(getOrganizationIdFromWorkspaceId).toHaveBeenCalledWith("ws_abc");
  });

  test("throws when workspace does not exist", async () => {
    vi.mocked(getWorkspace).mockResolvedValueOnce(null);
    await expect(resolveV3WorkspaceContext("ws_nonexistent")).rejects.toThrow(ResourceNotFoundError);
    expect(getWorkspace).toHaveBeenCalledWith("ws_nonexistent");
    expect(getOrganizationIdFromWorkspaceId).not.toHaveBeenCalled();
  });
});
