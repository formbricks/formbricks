import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockGetEnvironment = vi.fn();
const mockGetOrganizationIdFromProjectId = vi.fn();
const mockCheckAuthorizationUpdated = vi.fn();

vi.mock("@/lib/environment/service", () => ({
  getEnvironment: (...args: any[]) => mockGetEnvironment(...args),
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromProjectId: (...args: any[]) => mockGetOrganizationIdFromProjectId(...args),
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: (...args: any[]) => mockCheckAuthorizationUpdated(...args),
}));

const mockUserId = "user-abc-123";
const mockEnvironmentId = "env-abc-123";
const mockProjectId = "project-abc-123";
const mockOrganizationId = "org-abc-123";

describe("checkProjectAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns organizationId and projectId on successful access check", async () => {
    mockGetEnvironment.mockResolvedValue({ projectId: mockProjectId });
    mockGetOrganizationIdFromProjectId.mockResolvedValue(mockOrganizationId);
    mockCheckAuthorizationUpdated.mockResolvedValue(undefined);
    const { checkProjectAccess } = await import("./access");

    const result = await checkProjectAccess(mockUserId, mockEnvironmentId, "readWrite");

    expect(result).toEqual({ organizationId: mockOrganizationId, projectId: mockProjectId });
    expect(mockGetEnvironment).toHaveBeenCalledWith(mockEnvironmentId);
    expect(mockGetOrganizationIdFromProjectId).toHaveBeenCalledWith(mockProjectId);
    expect(mockCheckAuthorizationUpdated).toHaveBeenCalledWith({
      userId: mockUserId,
      organizationId: mockOrganizationId,
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        { type: "projectTeam", minPermission: "readWrite", projectId: mockProjectId },
      ],
    });
  });

  test("throws ResourceNotFoundError when environment is not found", async () => {
    mockGetEnvironment.mockResolvedValue(null);
    const { checkProjectAccess } = await import("./access");

    await expect(checkProjectAccess(mockUserId, mockEnvironmentId, "read")).rejects.toMatchObject({
      name: "ResourceNotFoundError",
      resourceType: "environment",
      resourceId: mockEnvironmentId,
    });
    expect(mockGetOrganizationIdFromProjectId).not.toHaveBeenCalled();
    expect(mockCheckAuthorizationUpdated).not.toHaveBeenCalled();
  });

  test("propagates authorization errors from checkAuthorizationUpdated", async () => {
    mockGetEnvironment.mockResolvedValue({ projectId: mockProjectId });
    mockGetOrganizationIdFromProjectId.mockResolvedValue(mockOrganizationId);
    mockCheckAuthorizationUpdated.mockRejectedValue(new Error("Unauthorized"));
    const { checkProjectAccess } = await import("./access");

    await expect(checkProjectAccess(mockUserId, mockEnvironmentId, "manage")).rejects.toThrow("Unauthorized");
  });
});
