import { describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationIdFromProjectId } from "@/lib/utils/helper";
import { getEnvironment } from "@/lib/utils/services";
import { resolveV3WorkspaceContext } from "./workspace-context";

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromProjectId: vi.fn(),
}));

vi.mock("@/lib/utils/services", () => ({
  getEnvironment: vi.fn(),
}));

describe("resolveV3WorkspaceContext", () => {
  test("returns environmentId, projectId and organizationId when workspace exists (today: workspaceId === environmentId)", async () => {
    vi.mocked(getEnvironment).mockResolvedValueOnce({
      id: "env_abc",
      projectId: "proj_xyz",
    } as any);
    vi.mocked(getOrganizationIdFromProjectId).mockResolvedValueOnce("org_123");
    const result = await resolveV3WorkspaceContext("env_abc");
    expect(result).toEqual({
      environmentId: "env_abc",
      projectId: "proj_xyz",
      organizationId: "org_123",
    });
    expect(getEnvironment).toHaveBeenCalledWith("env_abc");
    expect(getOrganizationIdFromProjectId).toHaveBeenCalledWith("proj_xyz");
  });

  test("throws when workspace (environment) does not exist", async () => {
    vi.mocked(getEnvironment).mockResolvedValueOnce(null);
    await expect(resolveV3WorkspaceContext("env_nonexistent")).rejects.toThrow(ResourceNotFoundError);
    expect(getEnvironment).toHaveBeenCalledWith("env_nonexistent");
    expect(getOrganizationIdFromProjectId).not.toHaveBeenCalled();
  });
});
