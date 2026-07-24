import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  mockAuthenticatedApiClient,
  mockCanManageOrganizationUsers,
  mockCreateTeam,
  mockGetApiKeyCreatorRole,
  mockHandleApiError,
  mockSuccessResponse,
} = vi.hoisted(() => ({
  mockAuthenticatedApiClient: vi.fn(),
  mockCanManageOrganizationUsers: vi.fn(),
  mockCreateTeam: vi.fn(),
  mockGetApiKeyCreatorRole: vi.fn(),
  mockHandleApiError: vi.fn(),
  mockSuccessResponse: vi.fn(),
}));

vi.mock("@/modules/api/v2/auth/authenticated-api-client", () => ({
  authenticatedApiClient: mockAuthenticatedApiClient,
}));

vi.mock("@/modules/api/v2/lib/response", () => ({
  responses: {
    createdResponse: mockSuccessResponse,
    successResponse: mockSuccessResponse,
  },
}));

vi.mock("@/modules/api/v2/lib/utils", () => ({
  handleApiError: mockHandleApiError,
}));

vi.mock("@/modules/api/v2/organizations/[organizationId]/teams/lib/teams", () => ({
  createTeam: mockCreateTeam,
  getTeams: vi.fn(),
}));

vi.mock("@/modules/api/v2/organizations/[organizationId]/users/lib/utils", () => ({
  canManageOrganizationUsers: mockCanManageOrganizationUsers,
  getApiKeyCreatorRole: mockGetApiKeyCreatorRole,
}));

const organizationId = "org123";
const apiKeyId = "apiKey123";
const teamInput = { name: "Test Team" };

const buildRequest = () =>
  new Request("http://localhost/api/v2/organizations/org123/teams", { method: "POST" });

describe("POST /organizations/[organizationId]/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthenticatedApiClient.mockImplementation(
      async ({ handler }: any) =>
        await handler({
          auditLog: undefined,
          authentication: {
            apiKeyId,
            organizationId,
            organizationAccess: { accessControl: { read: true, write: true } },
          },
          parsedInput: {
            body: teamInput,
            params: { organizationId },
          },
        })
    );
    mockHandleApiError.mockImplementation((_request, error) => Response.json({ error }, { status: 403 }));
    mockSuccessResponse.mockImplementation((body: unknown) => Response.json(body, { status: 201 }));
  });

  test("denies team creation when the API key creator can no longer manage users", async () => {
    mockGetApiKeyCreatorRole.mockResolvedValue(null);
    mockCanManageOrganizationUsers.mockReturnValue(false);

    const { POST } = await import("./route");
    const response = await POST(buildRequest(), { params: Promise.resolve({ organizationId }) });

    expect(mockGetApiKeyCreatorRole).toHaveBeenCalledWith(apiKeyId, organizationId);
    expect(mockCanManageOrganizationUsers).toHaveBeenCalledWith(null);
    expect(mockCreateTeam).not.toHaveBeenCalled();
    expect(mockHandleApiError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "forbidden" }),
      undefined
    );
    expect(response.status).toBe(403);
  });

  test("creates the team when the API key creator clears the user-management floor", async () => {
    mockGetApiKeyCreatorRole.mockResolvedValue("manager");
    mockCanManageOrganizationUsers.mockReturnValue(true);
    mockCreateTeam.mockResolvedValue({ ok: true, data: { id: "team123", ...teamInput, organizationId } });

    const { POST } = await import("./route");
    const response = await POST(buildRequest(), { params: Promise.resolve({ organizationId }) });

    expect(mockCreateTeam).toHaveBeenCalledWith(teamInput, organizationId);
    expect(response.status).toBe(201);
  });
});
