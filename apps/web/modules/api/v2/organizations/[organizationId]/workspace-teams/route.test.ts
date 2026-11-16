import { beforeEach, describe, expect, test, vi } from "vitest";
import type { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { DELETE, POST, PUT } from "./route";

const {
  mockAuthenticatedApiClient,
  mockCanManageOrganizationUsers,
  mockCheckAuthenticationAndAccess,
  mockCreateWorkspaceTeam,
  mockDeleteWorkspaceTeam,
  mockGetApiKeyCreatorRole,
  mockGetWorkspaceTeams,
  mockHandleApiError,
  mockHasOrganizationIdAndAccess,
  mockSuccessResponse,
  mockUpdateWorkspaceTeam,
} = vi.hoisted(() => ({
  mockAuthenticatedApiClient: vi.fn(),
  mockCanManageOrganizationUsers: vi.fn(),
  mockCheckAuthenticationAndAccess: vi.fn(),
  mockCreateWorkspaceTeam: vi.fn(),
  mockDeleteWorkspaceTeam: vi.fn(),
  mockGetApiKeyCreatorRole: vi.fn(),
  mockGetWorkspaceTeams: vi.fn(),
  mockHandleApiError: vi.fn(),
  mockHasOrganizationIdAndAccess: vi.fn(),
  mockSuccessResponse: vi.fn(),
  mockUpdateWorkspaceTeam: vi.fn(),
}));

vi.mock("@/modules/api/v2/auth/authenticated-api-client", () => ({
  authenticatedApiClient: mockAuthenticatedApiClient,
}));

vi.mock("@/modules/api/v2/lib/response", () => ({
  responses: { successResponse: mockSuccessResponse },
}));

vi.mock("@/modules/api/v2/lib/utils", () => ({
  handleApiError: mockHandleApiError,
}));

vi.mock("@/modules/api/v2/organizations/[organizationId]/lib/utils", () => ({
  hasOrganizationIdAndAccess: mockHasOrganizationIdAndAccess,
}));

vi.mock("@/modules/api/v2/organizations/[organizationId]/users/lib/utils", () => ({
  canManageOrganizationUsers: mockCanManageOrganizationUsers,
  getApiKeyCreatorRole: mockGetApiKeyCreatorRole,
}));

// Keep the real creator-role check; only stub the database-backed team/workspace lookup.
vi.mock(
  "@/modules/api/v2/organizations/[organizationId]/workspace-teams/lib/utils",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/modules/api/v2/organizations/[organizationId]/workspace-teams/lib/utils")
    >()),
    checkAuthenticationAndAccess: mockCheckAuthenticationAndAccess,
  })
);

vi.mock("./lib/workspace-teams", () => ({
  createWorkspaceTeam: mockCreateWorkspaceTeam,
  deleteWorkspaceTeam: mockDeleteWorkspaceTeam,
  getWorkspaceTeams: mockGetWorkspaceTeams,
  updateWorkspaceTeam: mockUpdateWorkspaceTeam,
}));

const organizationId = "clorg0000000000000000000a";
const apiKeyId = "apiKey123";
const teamId = "clteam000000000000000000a";
const workspaceId = "clws0000000000000000000a0";
const workspaceTeam = { teamId, workspaceId, permission: "manage" };

const buildRequest = (method: string) =>
  new Request(`http://localhost/api/v2/organizations/${organizationId}/workspace-teams`, { method });

const mutations = [
  {
    method: "POST",
    handler: POST,
    body: { teamId, workspaceId, permission: "manage" },
    write: mockCreateWorkspaceTeam,
  },
  {
    method: "PUT",
    handler: PUT,
    body: { teamId, workspaceId, permission: "manage" },
    write: mockUpdateWorkspaceTeam,
  },
  { method: "DELETE", handler: DELETE, query: { teamId, workspaceId }, write: mockDeleteWorkspaceTeam },
] as const;

describe.each(mutations)("$method /organizations/[organizationId]/workspace-teams", (mutation) => {
  const call = () =>
    mutation.handler(buildRequest(mutation.method), { params: Promise.resolve({ organizationId }) });

  beforeEach(() => {
    vi.clearAllMocks();
    mockHasOrganizationIdAndAccess.mockResolvedValue(true);
    mockCheckAuthenticationAndAccess.mockResolvedValue({ ok: true, data: true });
    mockGetWorkspaceTeams.mockResolvedValue({ ok: true, data: { data: [] } });
    mockCreateWorkspaceTeam.mockResolvedValue({ ok: true, data: workspaceTeam });
    mockUpdateWorkspaceTeam.mockResolvedValue({ ok: true, data: workspaceTeam });
    mockDeleteWorkspaceTeam.mockResolvedValue({ ok: true, data: workspaceTeam });

    mockAuthenticatedApiClient.mockImplementation(
      async ({ handler }: Parameters<typeof authenticatedApiClient>[0]) =>
        await handler({
          request: buildRequest(mutation.method),
          auditLog: undefined,
          authentication: {
            type: "apiKey",
            apiKeyId,
            organizationId,
            workspacePermissions: [],
            organizationAccess: { accessControl: { read: true, write: true } },
          },
          parsedInput: {
            body: "body" in mutation ? mutation.body : undefined,
            query: "query" in mutation ? mutation.query : undefined,
            params: { organizationId },
          },
        })
    );
    mockHandleApiError.mockImplementation((_request, error) => Response.json({ error }, { status: 403 }));
    mockSuccessResponse.mockImplementation((body: unknown) => Response.json(body, { status: 200 }));
  });

  test.each([
    ["creator was demoted below the user-management floor", "member"],
    ["key has no recorded creator, a deleted creator or a former member", null],
  ])("is refused with 403 when the %s", async (_label, role) => {
    mockGetApiKeyCreatorRole.mockResolvedValue(role);
    mockCanManageOrganizationUsers.mockReturnValue(false);

    const response = await call();

    expect(mockGetApiKeyCreatorRole).toHaveBeenCalledWith(apiKeyId, organizationId);
    expect(mockCanManageOrganizationUsers).toHaveBeenCalledWith(role);
    expect(mockHandleApiError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "forbidden" }),
      undefined
    );
    expect(response.status).toBe(403);
    // 403 precedes the id lookup so a refused key learns nothing about team/workspace ids.
    expect(mockCheckAuthenticationAndAccess).not.toHaveBeenCalled();
    expect(mutation.write).not.toHaveBeenCalled();
  });

  test("goes through when the creator clears the user-management floor", async () => {
    mockGetApiKeyCreatorRole.mockResolvedValue("manager");
    mockCanManageOrganizationUsers.mockReturnValue(true);

    const response = await call();

    expect(mockCheckAuthenticationAndAccess).toHaveBeenCalled();
    expect(mutation.write).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});
