import { responses } from "@/app/lib/api/response";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { Session } from "next-auth";
import { describe, expect, test, vi } from "vitest";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { checkAuth } from "./utils";

// Create mock response objects
const mockBadRequestResponse = new Response("Bad Request", { status: 400 });
const mockNotAuthenticatedResponse = new Response("Not authenticated", { status: 401 });
const mockUnauthorizedResponse = new Response("Unauthorized", { status: 401 });

vi.mock("@/lib/environment/auth", () => ({
  hasUserEnvironmentAccess: vi.fn(),
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
  const environmentId = "env-123";

  test("returns notAuthenticatedResponse when authentication is null", async () => {
    const result = await checkAuth(null, environmentId);

    expect(responses.notAuthenticatedResponse).toHaveBeenCalled();
    expect(result).toBe(mockNotAuthenticatedResponse);
  });

  test("returns notAuthenticatedResponse when authentication is undefined", async () => {
    const result = await checkAuth(undefined as any, environmentId);

    expect(responses.notAuthenticatedResponse).toHaveBeenCalled();
    expect(result).toBe(mockNotAuthenticatedResponse);
  });

  test("returns unauthorizedResponse when API key authentication lacks POST permission", async () => {
    const mockAuthentication: TAuthenticationApiKey = {
      type: "apiKey",
      environmentPermissions: [
        {
          environmentId: "env-123",
          permission: "read",
          environmentType: "development",
          projectId: "project-1",
          projectName: "Project 1",
        },
      ],
      hashedApiKey: "hashed-key",
      apiKeyId: "api-key-id",
      organizationId: "org-id",
      organizationAccess: {
        accessControl: {},
      },
    };

    vi.mocked(hasPermission).mockReturnValue(false);

    const result = await checkAuth(mockAuthentication, environmentId);

    expect(hasPermission).toHaveBeenCalledWith(
      mockAuthentication.environmentPermissions,
      environmentId,
      "POST"
    );
    expect(responses.unauthorizedResponse).toHaveBeenCalled();
    expect(result).toBe(mockUnauthorizedResponse);
  });

  test("returns undefined when API key authentication has POST permission", async () => {
    const mockAuthentication: TAuthenticationApiKey = {
      type: "apiKey",
      environmentPermissions: [
        {
          environmentId: "env-123",
          permission: "write",
          environmentType: "development",
          projectId: "project-1",
          projectName: "Project 1",
        },
      ],
      hashedApiKey: "hashed-key",
      apiKeyId: "api-key-id",
      organizationId: "org-id",
      organizationAccess: {
        accessControl: {},
      },
    };

    vi.mocked(hasPermission).mockReturnValue(true);

    const result = await checkAuth(mockAuthentication, environmentId);

    expect(hasPermission).toHaveBeenCalledWith(
      mockAuthentication.environmentPermissions,
      environmentId,
      "POST"
    );
    expect(result).toBeUndefined();
  });

  test("returns unauthorizedResponse when session exists but user lacks environment access", async () => {
    const mockSession: Session = {
      user: {
        id: "user-123",
      },
      expires: "2024-12-31T23:59:59.999Z",
    };

    vi.mocked(hasUserEnvironmentAccess).mockResolvedValue(false);

    const result = await checkAuth(mockSession, environmentId);

    expect(hasUserEnvironmentAccess).toHaveBeenCalledWith("user-123", environmentId);
    expect(responses.unauthorizedResponse).toHaveBeenCalled();
    expect(result).toBe(mockUnauthorizedResponse);
  });

  test("returns undefined when session exists and user has environment access", async () => {
    const mockSession: Session = {
      user: {
        id: "user-123",
      },
      expires: "2024-12-31T23:59:59.999Z",
    };

    vi.mocked(hasUserEnvironmentAccess).mockResolvedValue(true);

    const result = await checkAuth(mockSession, environmentId);

    expect(hasUserEnvironmentAccess).toHaveBeenCalledWith("user-123", environmentId);
    expect(result).toBeUndefined();
  });

  test("returns notAuthenticatedResponse when authentication object is neither session nor API key", async () => {
    const invalidAuth = { someProperty: "value" } as any;

    const result = await checkAuth(invalidAuth, environmentId);

    expect(responses.notAuthenticatedResponse).toHaveBeenCalled();
    expect(result).toBe(mockNotAuthenticatedResponse);
  });
});
