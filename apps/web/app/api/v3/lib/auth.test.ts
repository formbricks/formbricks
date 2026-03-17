import { ApiKeyPermission, EnvironmentType } from "@prisma/client";
import { describe, expect, test, vi } from "vitest";
import { AuthorizationError, ResourceNotFoundError } from "@formbricks/types/errors";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromProjectId } from "@/lib/utils/helper";
import { getEnvironment } from "@/lib/utils/services";
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
  getOrganizationIdFromProjectId: vi.fn(),
}));

vi.mock("@/lib/utils/services", () => ({
  getEnvironment: vi.fn(),
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
    expect(getEnvironment).not.toHaveBeenCalled();
    expect(checkAuthorizationUpdated).not.toHaveBeenCalled();
  });

  test("returns 401 when authentication is API key (no user)", async () => {
    const result = await requireSessionWorkspaceAccess(
      { apiKeyId: "key_1", organizationId: "org_1", environmentPermissions: [] } as any,
      "proj_abc",
      "read",
      requestId
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
    const body = await (result as Response).json();
    expect(body.requestId).toBe(requestId);
    expect(body.code).toBe("not_authenticated");
    expect(getEnvironment).not.toHaveBeenCalled();
  });

  test("returns 403 when workspace (environment) is not found (avoid leaking existence)", async () => {
    vi.mocked(getEnvironment).mockResolvedValueOnce(null);
    const result = await requireSessionWorkspaceAccess(
      { user: { id: "user_1" }, expires: "" } as any,
      "env_nonexistent",
      "read",
      requestId
    );
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
    expect((result as Response).headers.get("Content-Type")).toBe("application/problem+json");
    const body = await (result as Response).json();
    expect(body.requestId).toBe(requestId);
    expect(body.code).toBe("forbidden");
    expect(getEnvironment).toHaveBeenCalledWith("env_nonexistent");
    expect(checkAuthorizationUpdated).not.toHaveBeenCalled();
  });

  test("returns 403 when user has no access to workspace", async () => {
    vi.mocked(getEnvironment).mockResolvedValueOnce({
      id: "env_abc",
      projectId: "proj_abc",
    } as any);
    vi.mocked(getOrganizationIdFromProjectId).mockResolvedValueOnce("org_1");
    vi.mocked(checkAuthorizationUpdated).mockRejectedValueOnce(new AuthorizationError("Not authorized"));
    const result = await requireSessionWorkspaceAccess(
      { user: { id: "user_1" }, expires: "" } as any,
      "env_abc",
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
        { type: "projectTeam", projectId: "proj_abc", minPermission: "read" },
      ],
    });
  });

  test("returns workspace context when session is valid and user has access", async () => {
    vi.mocked(getEnvironment).mockResolvedValueOnce({
      id: "env_abc",
      projectId: "proj_abc",
    } as any);
    vi.mocked(getOrganizationIdFromProjectId).mockResolvedValueOnce("org_1");
    vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(undefined as any);
    const result = await requireSessionWorkspaceAccess(
      { user: { id: "user_1" }, expires: "" } as any,
      "env_abc",
      "readWrite",
      requestId
    );
    expect(result).not.toBeInstanceOf(Response);
    expect(result).toEqual({
      environmentId: "env_abc",
      projectId: "proj_abc",
      organizationId: "org_1",
    });
    expect(checkAuthorizationUpdated).toHaveBeenCalledWith({
      userId: "user_1",
      organizationId: "org_1",
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        { type: "projectTeam", projectId: "proj_abc", minPermission: "readWrite" },
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

function envPerm(environmentId: string, permission: ApiKeyPermission = ApiKeyPermission.read) {
  return {
    environmentId,
    environmentType: EnvironmentType.development,
    projectId: "proj_k",
    projectName: "K",
    permission,
  };
}

describe("requireV3WorkspaceAccess", () => {
  test("401 when authentication is null", async () => {
    const r = await requireV3WorkspaceAccess(null, "env_x", "read", requestId);
    expect((r as Response).status).toBe(401);
  });

  test("delegates to session flow when user is present", async () => {
    vi.mocked(getEnvironment).mockResolvedValueOnce({
      id: "env_s",
      projectId: "proj_s",
    } as any);
    vi.mocked(getOrganizationIdFromProjectId).mockResolvedValueOnce("org_s");
    vi.mocked(checkAuthorizationUpdated).mockResolvedValueOnce(undefined as any);
    const r = await requireV3WorkspaceAccess(
      { user: { id: "user_1" }, expires: "" } as any,
      "env_s",
      "read",
      requestId
    );
    expect(r).toEqual({
      environmentId: "env_s",
      projectId: "proj_s",
      organizationId: "org_s",
    });
  });

  test("returns context for API key with read on workspace", async () => {
    const auth = {
      ...keyBase,
      environmentPermissions: [envPerm("ws_a", ApiKeyPermission.read)],
    };
    const r = await requireV3WorkspaceAccess(auth as any, "ws_a", "read", requestId);
    expect(r).toEqual({
      environmentId: "ws_a",
      projectId: "proj_k",
      organizationId: "org_k",
    });
  });

  test("returns context for API key with write on workspace", async () => {
    const auth = {
      ...keyBase,
      environmentPermissions: [envPerm("ws_b", ApiKeyPermission.write)],
    };
    const r = await requireV3WorkspaceAccess(auth as any, "ws_b", "read", requestId);
    expect(r).toEqual({
      environmentId: "ws_b",
      projectId: "proj_k",
      organizationId: "org_k",
    });
  });

  test("403 when API key has no matching environment", async () => {
    const auth = {
      ...keyBase,
      environmentPermissions: [envPerm("other_env")],
    };
    const r = await requireV3WorkspaceAccess(auth as any, "wanted", "read", requestId);
    expect((r as Response).status).toBe(403);
  });

  test("403 when API key permission is not list-eligible (runtime value)", async () => {
    const auth = {
      ...keyBase,
      environmentPermissions: [
        {
          ...envPerm("ws_c"),
          permission: "invalid" as unknown as ApiKeyPermission,
        },
      ],
    };
    const r = await requireV3WorkspaceAccess(auth as any, "ws_c", "read", requestId);
    expect((r as Response).status).toBe(403);
  });

  test("returns context for API key with manage on workspace", async () => {
    const auth = {
      ...keyBase,
      environmentPermissions: [envPerm("ws_m", ApiKeyPermission.manage)],
    };
    const r = await requireV3WorkspaceAccess(auth as any, "ws_m", "read", requestId);
    expect(r).toEqual({
      environmentId: "ws_m",
      projectId: "proj_k",
      organizationId: "org_k",
    });
  });

  test("401 when auth is neither session nor valid API key payload", async () => {
    const r = await requireV3WorkspaceAccess({ user: {} } as any, "env", "read", requestId);
    expect((r as Response).status).toBe(401);
  });
});
