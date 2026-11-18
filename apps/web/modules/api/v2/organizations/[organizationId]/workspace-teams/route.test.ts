import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TApiAuditLog } from "@/app/lib/api/with-api-logging";
import type { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { DELETE, GET, POST, PUT } from "./route";

const {
  mockAuthenticatedApiClient,
  mockCheckAuthenticationAndAccess,
  mockCreateWorkspaceTeam,
  mockDeleteWorkspaceTeam,
  mockGetWorkspaceTeams,
  mockHandleApiError,
  mockHasOrganizationIdAndAccess,
  mockSuccessResponse,
  mockUpdateWorkspaceTeam,
} = vi.hoisted(() => ({
  mockAuthenticatedApiClient: vi.fn(),
  mockCheckAuthenticationAndAccess: vi.fn(),
  mockCreateWorkspaceTeam: vi.fn(),
  mockDeleteWorkspaceTeam: vi.fn(),
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

vi.mock("@/modules/api/v2/organizations/[organizationId]/workspace-teams/lib/utils", () => ({
  checkAuthenticationAndAccess: mockCheckAuthenticationAndAccess,
}));

vi.mock("./lib/workspace-teams", () => ({
  createWorkspaceTeam: mockCreateWorkspaceTeam,
  deleteWorkspaceTeam: mockDeleteWorkspaceTeam,
  getWorkspaceTeams: mockGetWorkspaceTeams,
  updateWorkspaceTeam: mockUpdateWorkspaceTeam,
}));

type THandlerArgs = Parameters<Parameters<typeof authenticatedApiClient>[0]["handler"]>[0];

const organizationId = "org123";
const teamId = "team123";
const workspaceId = "workspace123";
const workspaceTeam = { teamId, workspaceId, permission: "read" };
const params = { params: Promise.resolve({ organizationId }) };
const request = () => new Request("http://localhost/api/v2/organizations/org123/workspace-teams");

let parsedInput: THandlerArgs["parsedInput"];
let auditLog: TApiAuditLog;

describe("/organizations/[organizationId]/workspace-teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditLog = {
      action: "updated",
      targetType: "workspaceTeam",
      userId: UNKNOWN_DATA,
      targetId: UNKNOWN_DATA,
      organizationId,
      status: "failure",
      userType: "api",
      apiUrl: "http://localhost/api/v2/organizations/org123",
    };
    mockHasOrganizationIdAndAccess.mockResolvedValue(true);
    mockCheckAuthenticationAndAccess.mockResolvedValue({ ok: true, data: true });
    mockAuthenticatedApiClient.mockImplementation(
      async ({ handler }: Parameters<typeof authenticatedApiClient>[0]) =>
        await handler({
          request: request(),
          auditLog,
          authentication: {
            type: "apiKey",
            apiKeyId: "apiKey123",
            organizationId,
            workspacePermissions: [],
            organizationAccess: { accessControl: { read: true, write: true } },
          },
          parsedInput,
        })
    );
    mockHandleApiError.mockImplementation((_request, error) => Response.json({ error }, { status: 400 }));
    mockSuccessResponse.mockImplementation((body: unknown) => Response.json(body));
  });

  test("GET lists the organization's workspace teams with their legacy projectId", async () => {
    parsedInput = {
      query: { limit: 10, skip: 0, sortBy: "createdAt", order: "desc" },
      params: { organizationId },
    };
    mockGetWorkspaceTeams.mockResolvedValue({
      ok: true,
      data: { data: [workspaceTeam], meta: { total: 1 } },
    });

    const response = await GET(request(), params);

    expect(mockHasOrganizationIdAndAccess).toHaveBeenCalledWith(organizationId, expect.anything(), "read");
    expect(await response.json()).toEqual({
      data: [{ ...workspaceTeam, projectId: workspaceId }],
      meta: { total: 1 },
    });
  });

  test("POST creates a workspace team that does not exist yet", async () => {
    parsedInput = { body: workspaceTeam, params: { organizationId } };
    mockGetWorkspaceTeams.mockResolvedValue({ ok: true, data: { data: [], meta: { total: 0 } } });
    mockCreateWorkspaceTeam.mockResolvedValue({ ok: true, data: workspaceTeam });

    const response = await POST(request(), params);

    expect(mockCreateWorkspaceTeam).toHaveBeenCalledWith(workspaceTeam);
    expect(auditLog).toMatchObject({ targetId: `${workspaceId}-${teamId}`, newObject: workspaceTeam });
    expect(await response.json()).toEqual({ data: { ...workspaceTeam, projectId: workspaceId } });
  });

  test("PUT records the workspace team as it was before the update", async () => {
    const before = { ...workspaceTeam, permission: "readWrite" };
    parsedInput = { body: workspaceTeam, params: { organizationId } };
    mockGetWorkspaceTeams.mockResolvedValue({ ok: true, data: { data: [before], meta: { total: 1 } } });
    mockUpdateWorkspaceTeam.mockResolvedValue({ ok: true, data: workspaceTeam });

    await PUT(request(), params);

    expect(mockUpdateWorkspaceTeam).toHaveBeenCalledWith(teamId, workspaceId, { permission: "read" });
    expect(auditLog).toMatchObject({
      targetId: `${workspaceId}-${teamId}`,
      oldObject: before,
      newObject: workspaceTeam,
    });
  });

  test("DELETE records the deleted workspace team, or null when it could not be read first", async () => {
    parsedInput = { query: { teamId, workspaceId }, params: { organizationId } };
    mockGetWorkspaceTeams.mockResolvedValue({ ok: true, data: { data: [], meta: { total: 0 } } });
    mockDeleteWorkspaceTeam.mockResolvedValue({ ok: true, data: workspaceTeam });

    const response = await DELETE(request(), params);

    expect(mockDeleteWorkspaceTeam).toHaveBeenCalledWith(teamId, workspaceId);
    expect(auditLog).toMatchObject({ targetId: `${workspaceId}-${teamId}`, oldObject: null });
    expect(await response.json()).toEqual({ data: { ...workspaceTeam, projectId: workspaceId } });
  });
});
