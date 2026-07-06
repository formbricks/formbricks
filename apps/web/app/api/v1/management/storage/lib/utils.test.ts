import { describe, expect, test, vi } from "vitest";
import type { Session, TAuthenticationApiKey } from "@formbricks/types/auth";
import { responses } from "@/app/lib/api/response";
import { hasUserWorkspaceAccessForAction } from "@/lib/workspace/auth";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { checkAuth } from "./utils";

// Create mock response objects
const mockBadRequestResponse = new Response("Bad Request", { status: 400 });
const mockNotAuthenticatedResponse = new Response("Not authenticated", { status: 401 });
const mockUnauthorizedResponse = new Response("Unauthorized", { status: 401 });

vi.mock("@/lib/workspace/auth", () => ({
  hasUserWorkspaceAccessForAction: vi.fn(),
}));

vi.mock("@/modules/organization/settings/api-keys/lib/utils", () => ({
  hasPermission: vi.fn(),
}));

vi.mock("@/app/lib/api/response", () => ({
  responses: {
    badRequestResponse: vi.fn(() => mockBadRequestResponse),
    notAuthenticatedResponse: vi.fn(() => mockNotAuthenticatedResponse),
    unauthorizedResponse: vi.fn(() => mockUnauthorizedResponse),
  },
}));

describe("checkAuth", () => {
  const workspaceId = "workspace-123";

  test("returns notAuthenticatedResponse when authentication is null", async () => {
    const result = await checkAuth(null, workspaceId);

    expect(responses.notAuthenticatedResponse).toHaveBeenCalled();
    expect(result).toBe(mockNotAuthenticatedResponse);
  });

  test("returns notAuthenticatedResponse when authentication is undefined", async () => {
    const result = await checkAuth(undefined as any, workspaceId);

    expect(responses.notAuthenticatedResponse).toHaveBeenCalled();
    expect(result).toBe(mockNotAuthenticatedResponse);
  });

  test("returns unauthorizedResponse when API key authentication lacks POST permission", async () => {
    const mockAuthentication: TAuthenticationApiKey = {
      type: "apiKey",
      workspacePermissions: [
        {
          permission: "read",
          workspaceId: "workspace-123",
          workspaceName: "Workspace 1",
        },
      ],
      apiKeyId: "hashed-key",
      organizationId: "org-id",
      organizationAccess: {
        accessControl: {},
      },
    };

    vi.mocked(hasPermission).mockReturnValue(false);

    const result = await checkAuth(mockAuthentication, workspaceId);

    expect(hasPermission).toHaveBeenCalledWith(
      mockAuthentication.workspacePermissions,
      "workspace-123",
      "POST"
    );
    expect(responses.unauthorizedResponse).toHaveBeenCalled();
    expect(result).toBe(mockUnauthorizedResponse);
  });

  test("returns undefined when API key authentication has POST permission", async () => {
    const mockAuthentication: TAuthenticationApiKey = {
      type: "apiKey",
      workspacePermissions: [
        {
          permission: "write",
          workspaceId: "workspace-123",
          workspaceName: "Workspace 1",
        },
      ],
      apiKeyId: "hashed-key",
      organizationId: "org-id",
      organizationAccess: {
        accessControl: {},
      },
    };

    vi.mocked(hasPermission).mockReturnValue(true);

    const result = await checkAuth(mockAuthentication, workspaceId);

    expect(hasPermission).toHaveBeenCalledWith(
      mockAuthentication.workspacePermissions,
      "workspace-123",
      "POST"
    );
    expect(result).toBeUndefined();
  });

  test("returns unauthorizedResponse when session exists but user lacks workspace access", async () => {
    const mockSession: Session = {
      user: {
        id: "user-123",
      },
      expires: "2024-12-31T23:59:59.999Z",
    };

    vi.mocked(hasUserWorkspaceAccessForAction).mockResolvedValue(false);

    const result = await checkAuth(mockSession, workspaceId);

    expect(hasUserWorkspaceAccessForAction).toHaveBeenCalledWith("user-123", workspaceId, "POST");
    expect(responses.unauthorizedResponse).toHaveBeenCalled();
    expect(result).toBe(mockUnauthorizedResponse);
  });

  test("returns undefined when session exists and user has workspace access", async () => {
    const mockSession: Session = {
      user: {
        id: "user-123",
      },
      expires: "2024-12-31T23:59:59.999Z",
    };

    vi.mocked(hasUserWorkspaceAccessForAction).mockResolvedValue(true);

    const result = await checkAuth(mockSession, workspaceId);

    expect(hasUserWorkspaceAccessForAction).toHaveBeenCalledWith("user-123", workspaceId, "POST");
    expect(result).toBeUndefined();
  });

  test("returns notAuthenticatedResponse when authentication object is neither session nor API key", async () => {
    const invalidAuth = { someProperty: "value" } as any;

    const result = await checkAuth(invalidAuth, workspaceId);

    expect(responses.notAuthenticatedResponse).toHaveBeenCalled();
    expect(result).toBe(mockNotAuthenticatedResponse);
  });
});
