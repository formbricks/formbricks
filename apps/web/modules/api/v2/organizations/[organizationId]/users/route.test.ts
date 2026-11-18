import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TApiAuditLog } from "@/app/lib/api/with-api-logging";
import type { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { GET, PATCH, POST } from "./route";

const {
  mockAuthenticatedApiClient,
  mockCanManageOrganizationUsers,
  mockCanModifyOrganizationMember,
  mockCreateUser,
  mockGetApiKeyCreatorRole,
  mockGetMembershipRoleByEmail,
  mockGetUsers,
  mockHandleApiError,
  mockHasOrganizationIdAndAccess,
  mockMayAssignOrganizationRole,
  mockSuccessResponse,
  mockUpdateUser,
} = vi.hoisted(() => ({
  mockAuthenticatedApiClient: vi.fn(),
  mockCanManageOrganizationUsers: vi.fn(),
  mockCanModifyOrganizationMember: vi.fn(),
  mockCreateUser: vi.fn(),
  mockGetApiKeyCreatorRole: vi.fn(),
  mockGetMembershipRoleByEmail: vi.fn(),
  mockGetUsers: vi.fn(),
  mockHandleApiError: vi.fn(),
  mockHasOrganizationIdAndAccess: vi.fn(),
  mockMayAssignOrganizationRole: vi.fn(),
  mockSuccessResponse: vi.fn(),
  mockUpdateUser: vi.fn(),
}));

vi.mock("@/lib/constants", () => ({ IS_FORMBRICKS_CLOUD: false }));

vi.mock("@/modules/api/v2/auth/authenticated-api-client", () => ({
  authenticatedApiClient: mockAuthenticatedApiClient,
}));

vi.mock("@/modules/api/v2/lib/response", () => ({
  responses: { createdResponse: mockSuccessResponse, successResponse: mockSuccessResponse },
}));

vi.mock("@/modules/api/v2/lib/utils", () => ({
  handleApiError: mockHandleApiError,
}));

vi.mock("@/modules/api/v2/organizations/[organizationId]/lib/utils", () => ({
  hasOrganizationIdAndAccess: mockHasOrganizationIdAndAccess,
}));

vi.mock("@/modules/api/v2/organizations/[organizationId]/users/lib/users", () => ({
  createUser: mockCreateUser,
  getUsers: mockGetUsers,
  updateUser: mockUpdateUser,
}));

vi.mock("@/modules/api/v2/organizations/[organizationId]/users/lib/utils", () => ({
  canManageOrganizationUsers: mockCanManageOrganizationUsers,
  canModifyOrganizationMember: mockCanModifyOrganizationMember,
  getApiKeyCreatorRole: mockGetApiKeyCreatorRole,
  getMembershipRoleByEmail: mockGetMembershipRoleByEmail,
  mayAssignOrganizationRole: mockMayAssignOrganizationRole,
}));

type THandlerArgs = Parameters<Parameters<typeof authenticatedApiClient>[0]["handler"]>[0];

const organizationId = "org123";
const apiKeyId = "apiKey123";
const user = { id: "user123", email: "member@example.com", name: "Member", role: "member" };
const params = { params: Promise.resolve({ organizationId }) };
const request = () => new Request("http://localhost/api/v2/organizations/org123/users");

let parsedInput: THandlerArgs["parsedInput"];
let auditLog: TApiAuditLog;

describe("/organizations/[organizationId]/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditLog = {
      action: "updated",
      targetType: "user",
      userId: UNKNOWN_DATA,
      targetId: UNKNOWN_DATA,
      organizationId,
      status: "failure",
      userType: "api",
      apiUrl: "http://localhost/api/v2/organizations/org123",
    };
    mockHasOrganizationIdAndAccess.mockResolvedValue(true);
    mockGetApiKeyCreatorRole.mockResolvedValue("owner");
    mockGetMembershipRoleByEmail.mockResolvedValue("member");
    mockCanManageOrganizationUsers.mockReturnValue(true);
    mockCanModifyOrganizationMember.mockReturnValue(true);
    mockMayAssignOrganizationRole.mockResolvedValue(true);
    mockAuthenticatedApiClient.mockImplementation(
      async ({ handler }: Parameters<typeof authenticatedApiClient>[0]) =>
        await handler({
          request: request(),
          auditLog,
          authentication: {
            type: "apiKey",
            apiKeyId,
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

  test("GET lists the organization's users", async () => {
    const query = { limit: 10, skip: 0, sortBy: "createdAt", order: "desc" };
    parsedInput = { query, params: { organizationId } };
    mockGetUsers.mockResolvedValue({ ok: true, data: { data: [user], meta: { total: 1 } } });

    const response = await GET(request() as NextRequest, params);

    expect(mockGetUsers).toHaveBeenCalledWith(organizationId, query);
    expect(await response.json()).toEqual({ data: [user], meta: { total: 1 } });
  });

  test("POST creates the user and records it in the audit log", async () => {
    const body = { email: user.email, name: user.name, role: "member" };
    parsedInput = { body, params: { organizationId } };
    mockCreateUser.mockResolvedValue({ ok: true, data: user });

    const response = await POST(request(), params);

    expect(mockMayAssignOrganizationRole).toHaveBeenCalledWith(organizationId, "owner", "member");
    expect(mockCreateUser).toHaveBeenCalledWith(body, organizationId);
    expect(auditLog).toMatchObject({ targetId: user.id, newObject: user });
    expect(await response.json()).toEqual({ data: user });
  });

  describe("PATCH", () => {
    const body = { email: user.email, name: "Renamed" };
    const updated = { ...user, name: "Renamed" };

    beforeEach(() => {
      parsedInput = { body, params: { organizationId } };
      mockUpdateUser.mockResolvedValue({ ok: true, data: updated });
    });

    test("records the user as it was before the update", async () => {
      mockGetUsers.mockResolvedValue({ ok: true, data: { data: [user], meta: { total: 1 } } });

      await PATCH(request(), params);

      expect(mockUpdateUser).toHaveBeenCalledWith(body, organizationId);
      expect(auditLog).toMatchObject({ targetId: user.id, oldObject: user, newObject: updated });
    });

    test("falls back to the updated user's id when the old one could not be read", async () => {
      mockGetUsers.mockResolvedValue({ ok: true, data: { data: [], meta: { total: 0 } } });

      await PATCH(request(), params);

      expect(auditLog).toMatchObject({ targetId: updated.id, oldObject: null, newObject: updated });
      expect(auditLog.targetId).not.toBe(UNKNOWN_DATA);
    });

    test("does not take a non-string id from the old user as the audit target", async () => {
      mockGetUsers.mockResolvedValue({ ok: true, data: { data: [{ ...user, id: 42 }], meta: { total: 1 } } });

      await PATCH(request(), params);

      expect(auditLog.targetId).toBe(updated.id);
    });
  });
});
