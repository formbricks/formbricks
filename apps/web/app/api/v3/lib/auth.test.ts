import { ApiKeyPermission } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError } from "@formbricks/types/errors";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getWorkspace } from "@/lib/utils/services";
import { requireSessionWorkspaceAccess, requireV3WorkspaceAccess } from "./auth";

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn(),
}));

vi.mock("@/lib/utils/services", () => ({
  getWorkspace: vi.fn(),
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: vi.fn(),
}));

const requestId = "req-123";

describe("requireSessionWorkspaceAccess", () => {
  test("returns 401 when authentication is null", async () => {
    const result = await requireSessionWorkspaceAccess(null, "proj_abc", "read", requestId);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    expect((result as Response).headers.get("Content-Type")).toBe("application/problem+json");
    const body = await (result as Response).json();
    expect(body.requestId).toBe(requestId);
    expect(body.status).toBe(401);
    expect(body.code).toBe("not_authenticated");
    expect(getWorkspace).not.toHaveBeenCalled();
    expect(checkAuthorizationUpdated).not.toHaveBeenCalled();
  });

  test("returns 401 when authentication is API key (no user)", async () => {
    const result = await requireSessionWorkspaceAccess(
      { apiKeyId: "key_1", organizationId: "org_1", workspacePermissions: [] } as any,
      "proj_abc",
      "read",
      requestId
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    const body = await (result as Response).json();
    expect(body.requestId).toBe(requestId);
    expect(body.code).toBe("not_authenticated");
    expect(getWorkspace).not.toHaveBeenCalled();
  });

  test("returns 403 when workspace is not found (avoid leaking existence)", async () => {
    vi.mocked(getWorkspace).mockResolvedValueOnce(null);
    const result = await requireSessionWorkspaceAccess(
      { user: { id: "user_1" }, expires: "" } as any,
      "ws_nonexistent",
      "read",
      requestId
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect((result as Response).headers.get("Content-Type")).toBe("application/problem+json");
    const body = await (result as Response).json();
    expect(body.requestId).toBe(requestId);
    expect(body.code).toBe("forbidden");
    expect(getWorkspace).toHaveBeenCalledWith("ws_nonexistent");
    expect(checkAuthorizationUpdated).not.toHaveBeenCalled();
  });

  test("returns 403 when user has no access to workspace", async () => {
    vi.mocked(getWorkspace).mockResolvedValueOnce({
      organizationId: "org_1",
    } as any);
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValueOnce("org_1");
    vi.mocked(checkAuthorizationUpdated).mockRejectedValueOnce(new AuthorizationError("Not authorized"));
    const result = await requireSessionWorkspaceAccess(
      { user: { id: "user_1" }, expires: "" } as any,
      "proj_abc",
      "read",
      requestId
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    const body = await (result as Response).json();
    expect(body.requestId).toBe(requestId);
    expect(body.code).toBe("forbidden");
    expect(checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId: "user_1",
      organizationId: "org_1",
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        { type: "workspaceTeam", workspaceId: "proj_abc", minPermission: "read" },
      ],
    });
  });

  test("returns workspace context when session is valid and user has access", async () => {
    vi.mocked(getWorkspace).mockResolvedValueOnce({
      organizationId: "org_1",
    } as any);
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValueOnce("org_1");
    vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(undefined as any);
    const result = await requireSessionWorkspaceAccess(
      { user: { id: "user_1" }, expires: "" } as any,
      "proj_abc",
      "readWrite",
      requestId
    );
    expect(result).not.toBeInstanceOf(Response);
    expect(result).toEqual({
      workspaceId: "proj_abc",
      organizationId: "org_1",
    });
    expect(checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId: "user_1",
      organizationId: "org_1",
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        { type: "workspaceTeam", workspaceId: "proj_abc", minPermission: "readWrite" },
      ],
    });
  });
});

const keyBase = {
  type: "apiKey" as const,
  apiKeyId: "key_1",
  organizationId: "org_k",
  organizationAccess: { accessControl: { read: true, write: false } },
};

function wsPerm(workspaceId: string, permission: ApiKeyPermission = ApiKeyPermission.read) {
  return {
    workspaceId,
    workspaceName: "K",
    permission,
  };
}

describe("requireV3WorkspaceAccess", () => {
  beforeEach(() => {
    vi.mocked(getWorkspace).mockResolvedValue({
      organizationId: "org_k",
    } as any);
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue("org_k");
  });

  test("401 when authentication is null", async () => {
    const r = await requireV3WorkspaceAccess(null, "ws_x", "read", requestId);
    expect((r as Response).status).toBe(401);
  });

  test("delegates to session flow when user is present", async () => {
    vi.mocked(getWorkspace).mockResolvedValueOnce({
      organizationId: "org_s",
    } as any);
    vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValueOnce("org_s");
    vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(undefined as any);
    const r = await requireV3WorkspaceAccess(
      { user: { id: "user_1" }, expires: "" } as any,
      "proj_s",
      "read",
      requestId
    );
    expect(r).toEqual({
      workspaceId: "proj_s",
      organizationId: "org_s",
    });
  });

  test("returns context for API key with read on workspace", async () => {
    const auth = {
      ...keyBase,
      workspacePermissions: [wsPerm("proj_k", ApiKeyPermission.read)],
    };
    const r = await requireV3WorkspaceAccess(auth as any, "proj_k", "read", requestId);
    expect(r).toEqual({
      workspaceId: "proj_k",
      organizationId: "org_k",
    });
    expect(getWorkspace).toHaveBeenCalledWith("proj_k");
  });

  test("returns context for API key with write on workspace", async () => {
    const auth = {
      ...keyBase,
      workspacePermissions: [wsPerm("proj_k", ApiKeyPermission.write)],
    };
    const r = await requireV3WorkspaceAccess(auth as any, "proj_k", "read", requestId);
    expect(r).toEqual({
      workspaceId: "proj_k",
      organizationId: "org_k",
    });
  });

  test("returns 403 when API key permission is lower than the required permission", async () => {
    const auth = {
      ...keyBase,
      workspacePermissions: [wsPerm("proj_k", ApiKeyPermission.read)],
    };
    const r = await requireV3WorkspaceAccess(auth as any, "proj_k", "readWrite", requestId);
    expect((r as Response).status).toBe(403);
  });

  test("403 when API key has no matching workspace", async () => {
    const auth = {
      ...keyBase,
      workspacePermissions: [wsPerm("other_workspace")],
    };
    const r = await requireV3WorkspaceAccess(auth as any, "proj_k", "read", requestId);
    expect((r as Response).status).toBe(403);
  });

  test("403 when API key permission is not list-eligible (runtime value)", async () => {
    const auth = {
      ...keyBase,
      workspacePermissions: [
        {
          ...wsPerm("proj_k"),
          permission: "invalid" as unknown as ApiKeyPermission,
        },
      ],
    };
    const r = await requireV3WorkspaceAccess(auth as any, "proj_k", "read", requestId);
    expect((r as Response).status).toBe(403);
  });

  test("returns context for API key with manage on workspace", async () => {
    const auth = {
      ...keyBase,
      workspacePermissions: [wsPerm("proj_k", ApiKeyPermission.manage)],
    };
    const r = await requireV3WorkspaceAccess(auth as any, "proj_k", "manage", requestId);
    expect(r).toEqual({
      workspaceId: "proj_k",
      organizationId: "org_k",
    });
  });

  test("returns 403 when the workspace cannot be resolved for an API key", async () => {
    vi.mocked(getWorkspace).mockResolvedValueOnce(null);
    const auth = {
      ...keyBase,
      workspacePermissions: [wsPerm("proj_k", ApiKeyPermission.manage)],
    };
    const r = await requireV3WorkspaceAccess(auth as any, "ws_missing", "read", requestId);
    expect((r as Response).status).toBe(403);
  });

  test("401 when auth is neither session nor valid API key payload", async () => {
    const r = await requireV3WorkspaceAccess({ user: {} } as any, "ws", "read", requestId);
    expect((r as Response).status).toBe(401);
  });
});
