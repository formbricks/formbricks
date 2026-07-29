import { beforeEach, describe, expect, test, vi } from "vitest";
import type { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";

const {
  mockAuthenticatedApiClient,
  mockCanManageOrganizationUsers,
  mockDeleteTeam,
  mockGetApiKeyCreatorRole,
  mockGetTeam,
  mockHandleApiError,
  mockSuccessResponse,
  mockUpdateTeam,
} = vi.hoisted(() => ({
  mockAuthenticatedApiClient: vi.fn(),
  mockCanManageOrganizationUsers: vi.fn(),
  mockDeleteTeam: vi.fn(),
  mockGetApiKeyCreatorRole: vi.fn(),
  mockGetTeam: vi.fn(),
  mockHandleApiError: vi.fn(),
  mockSuccessResponse: vi.fn(),
  mockUpdateTeam: vi.fn(),
}));

vi.mock("@/modules/api/v2/auth/authenticated-api-client", () => ({
  authenticatedApiClient: mockAuthenticatedApiClient,
}));

vi.mock("@/modules/api/v2/lib/response", () => ({
  responses: {
    successResponse: mockSuccessResponse,
  },
}));

vi.mock("@/modules/api/v2/lib/utils", () => ({
  handleApiError: mockHandleApiError,
}));

vi.mock("@/modules/api/v2/organizations/[organizationId]/teams/[teamId]/lib/teams", () => ({
  deleteTeam: mockDeleteTeam,
  getTeam: mockGetTeam,
  updateTeam: mockUpdateTeam,
}));

vi.mock("@/modules/api/v2/organizations/[organizationId]/users/lib/utils", () => ({
  canManageOrganizationUsers: mockCanManageOrganizationUsers,
  getApiKeyCreatorRole: mockGetApiKeyCreatorRole,
}));

const organizationId = "org123";
const apiKeyId = "apiKey123";
const teamId = "team123";
const team = { id: teamId, organizationId, name: "Test Team" };

const buildRequest = (method: string) =>
  new Request(`http://localhost/api/v2/organizations/org123/teams/${teamId}`, { method });

describe("PUT/DELETE /organizations/[organizationId]/teams/[teamId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthenticatedApiClient.mockImplementation(
      async ({ handler }: Parameters<typeof authenticatedApiClient>[0]) =>
        await handler({
          request: buildRequest("DELETE"),
          auditLog: undefined,
          authentication: {
            type: "apiKey",
            apiKeyId,
            organizationId,
            workspacePermissions: [],
            organizationAccess: { accessControl: { read: true, write: true } },
          },
          parsedInput: {
            body: { name: "Renamed Team" },
            params: { organizationId, teamId },
          },
        })
    );
    mockHandleApiError.mockImplementation((_request, error) => Response.json({ error }, { status: 403 }));
    mockSuccessResponse.mockImplementation((body: unknown) => Response.json(body, { status: 200 }));
    mockGetTeam.mockResolvedValue({ ok: true, data: team });
  });

  describe("DELETE", () => {
    test("denies team deletion when the API key creator can no longer manage users", async () => {
      mockGetApiKeyCreatorRole.mockResolvedValue(null);
      mockCanManageOrganizationUsers.mockReturnValue(false);

      const { DELETE } = await import("./route");
      const response = await DELETE(buildRequest("DELETE"), {
        params: Promise.resolve({ organizationId, teamId }),
      });

      expect(mockGetApiKeyCreatorRole).toHaveBeenCalledWith(apiKeyId, organizationId);
      expect(mockCanManageOrganizationUsers).toHaveBeenCalledWith(null);
      expect(mockDeleteTeam).not.toHaveBeenCalled();
      expect(mockHandleApiError).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "forbidden" }),
        undefined
      );
      expect(response.status).toBe(403);
    });

    test("deletes the team when the API key creator clears the user-management floor", async () => {
      mockGetApiKeyCreatorRole.mockResolvedValue("manager");
      mockCanManageOrganizationUsers.mockReturnValue(true);
      mockDeleteTeam.mockResolvedValue({ ok: true, data: team });

      const { DELETE } = await import("./route");
      const response = await DELETE(buildRequest("DELETE"), {
        params: Promise.resolve({ organizationId, teamId }),
      });

      expect(mockCanManageOrganizationUsers).toHaveBeenCalledWith("manager");
      expect(mockDeleteTeam).toHaveBeenCalledWith(organizationId, teamId);
      expect(response.status).toBe(200);
    });
  });

  describe("PUT", () => {
    test("denies team rename when the API key creator can no longer manage users", async () => {
      mockGetApiKeyCreatorRole.mockResolvedValue(null);
      mockCanManageOrganizationUsers.mockReturnValue(false);

      const { PUT } = await import("./route");
      const response = await PUT(buildRequest("PUT"), {
        params: Promise.resolve({ organizationId, teamId }),
      });

      expect(mockGetApiKeyCreatorRole).toHaveBeenCalledWith(apiKeyId, organizationId);
      expect(mockCanManageOrganizationUsers).toHaveBeenCalledWith(null);
      expect(mockUpdateTeam).not.toHaveBeenCalled();
      expect(mockHandleApiError).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: "forbidden" }),
        undefined
      );
      expect(response.status).toBe(403);
    });

    test("renames the team when the API key creator clears the user-management floor", async () => {
      mockGetApiKeyCreatorRole.mockResolvedValue("manager");
      mockCanManageOrganizationUsers.mockReturnValue(true);
      mockUpdateTeam.mockResolvedValue({ ok: true, data: { ...team, name: "Renamed Team" } });

      const { PUT } = await import("./route");
      const response = await PUT(buildRequest("PUT"), {
        params: Promise.resolve({ organizationId, teamId }),
      });

      expect(mockCanManageOrganizationUsers).toHaveBeenCalledWith("manager");
      expect(mockUpdateTeam).toHaveBeenCalledWith(organizationId, teamId, { name: "Renamed Team" });
      expect(response.status).toBe(200);
    });
  });
});
