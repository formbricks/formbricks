import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockGetOrganizationIdFromWorkspaceId = vi.fn();
const mockCheckAuthorizationUpdated = vi.fn();

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: (...args: any[]) => mockGetOrganizationIdFromWorkspaceId(...args),
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: (...args: any[]) => mockCheckAuthorizationUpdated(...args),
}));

const mockUserId = "user-abc-123";
const mockWorkspaceId = "workspace-abc-123";
const mockOrganizationId = "org-abc-123";

describe("checkWorkspaceAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns organizationId and workspaceId on successful access check", async () => {
    mockGetOrganizationIdFromWorkspaceId.mockResolvedValue(mockOrganizationId);
    mockCheckAuthorizationUpdated.mockResolvedValue(undefined);
    const { checkWorkspaceAccess } = await import("./access");

    const result = await checkWorkspaceAccess(mockUserId, mockWorkspaceId, "readWrite");

    expect(result).toEqual({ organizationId: mockOrganizationId, workspaceId: mockWorkspaceId });
    expect(mockGetOrganizationIdFromWorkspaceId).toHaveBeenCalledWith(mockWorkspaceId);
    expect(mockCheckAuthorizationUpdated).toHaveBeenCalledWith({
      userId: mockUserId,
      organizationId: mockOrganizationId,
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        { type: "workspaceTeam", minPermission: "readWrite", workspaceId: mockWorkspaceId },
      ],
    });
  });

  test("propagates authorization errors from checkAuthorizationUpdated", async () => {
    mockGetOrganizationIdFromWorkspaceId.mockResolvedValue(mockOrganizationId);
    mockCheckAuthorizationUpdated.mockRejectedValue(new Error("Unauthorized"));
    const { checkWorkspaceAccess } = await import("./access");

    await expect(checkWorkspaceAccess(mockUserId, mockWorkspaceId, "manage")).rejects.toThrow("Unauthorized");
  });
});
