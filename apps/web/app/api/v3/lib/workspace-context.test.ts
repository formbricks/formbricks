import { describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { findWorkspaceByIdOrLegacyEnvId } from "@/lib/utils/resolve-client-id";
import { resolveV3WorkspaceContext } from "./workspace-context";

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn(),
}));

vi.mock("@/lib/utils/resolve-client-id", () => ({
  findWorkspaceByIdOrLegacyEnvId: vi.fn(),
}));

describe("resolveV3WorkspaceContext", () => {
  test("returns workspaceId and organizationId when workspace exists", async () => {
    vi.mocked(findWorkspaceByIdOrLegacyEnvId).mockResolvedValueOnce({ id: "ws_abc" });
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValueOnce("org_123");
    const result = await resolveV3WorkspaceContext("ws_abc");
    expect(result).toEqual({
      workspaceId: "ws_abc",
      organizationId: "org_123",
    });
    expect(findWorkspaceByIdOrLegacyEnvId).toHaveBeenCalledWith("ws_abc");
    expect(getOrganizationIdFromWorkspaceId).toHaveBeenCalledWith("ws_abc");
  });

  test("resolves legacy environmentId to canonical workspaceId", async () => {
    vi.mocked(findWorkspaceByIdOrLegacyEnvId).mockResolvedValueOnce({ id: "ws_canonical" });
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValueOnce("org_456");
    const result = await resolveV3WorkspaceContext("env_legacy");
    expect(result).toEqual({
      workspaceId: "ws_canonical",
      organizationId: "org_456",
    });
    expect(getOrganizationIdFromWorkspaceId).toHaveBeenCalledWith("ws_canonical");
  });

  test("throws when workspace does not exist", async () => {
    vi.mocked(findWorkspaceByIdOrLegacyEnvId).mockResolvedValueOnce(null);
    await expect(resolveV3WorkspaceContext("ws_nonexistent")).rejects.toThrow(ResourceNotFoundError);
    expect(findWorkspaceByIdOrLegacyEnvId).toHaveBeenCalledWith("ws_nonexistent");
    expect(getOrganizationIdFromWorkspaceId).not.toHaveBeenCalled();
  });
});
