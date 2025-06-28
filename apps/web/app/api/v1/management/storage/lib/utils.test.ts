import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { Session } from "next-auth";
import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { vi } from "vitest";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { checkForRequiredFields } from "./utils";
import { checkAuth } from "./utils";

// Create mock response objects
const mockBadRequestResponse = new Response("Bad Request", { status: 400 });
const mockNotAuthenticatedResponse = new Response("Not authenticated", { status: 401 });
const mockUnauthorizedResponse = new Response("Unauthorized", { status: 401 });

vi.mock("@/app/api/v1/auth", () => ({
  authenticateRequest: vi.fn(),
}));

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

describe("checkForRequiredFields", () => {
  test("should return undefined when all required fields are present", () => {
    const result = checkForRequiredFields("env-123", "image/png", "test-file.png");
    expect(result).toBeUndefined();
  });

  test("should return bad request response when environmentId is missing", () => {
    const result = checkForRequiredFields("", "image/png", "test-file.png");
    expect(responses.badRequestResponse).toHaveBeenCalledWith("environmentId is required");
    expect(result).toBe(mockBadRequestResponse);
  });

  test("should return bad request response when fileType is missing", () => {
    const result = checkForRequiredFields("env-123", "", "test-file.png");
    expect(responses.badRequestResponse).toHaveBeenCalledWith("contentType is required");
    expect(result).toBe(mockBadRequestResponse);
  });

  test("should return bad request response when encodedFileName is missing", () => {
    const result = checkForRequiredFields("env-123", "image/png", "");
    expect(responses.badRequestResponse).toHaveBeenCalledWith("fileName is required");
    expect(result).toBe(mockBadRequestResponse);
  });

  test("should return bad request response when environmentId is undefined", () => {
    const result = checkForRequiredFields(undefined as any, "image/png", "test-file.png");
    expect(responses.badRequestResponse).toHaveBeenCalledWith("environmentId is required");
    expect(result).toBe(mockBadRequestResponse);
  });

  test("should return bad request response when fileType is undefined", () => {
    const result = checkForRequiredFields("env-123", undefined as any, "test-file.png");
    expect(responses.badRequestResponse).toHaveBeenCalledWith("contentType is required");
    expect(result).toBe(mockBadRequestResponse);
  });

  test("should return bad request response when encodedFileName is undefined", () => {
    const result = checkForRequiredFields("env-123", "image/png", undefined as any);
    expect(responses.badRequestResponse).toHaveBeenCalledWith("fileName is required");
    expect(result).toBe(mockBadRequestResponse);
  });
});

describe("checkAuth", () => {
  const environmentId = "env-123";
  const mockRequest = new NextRequest("http://localhost:3000/api/test");

  test("returns notAuthenticatedResponse when no session and no authentication", async () => {
    vi.mocked(authenticateRequest).mockResolvedValue(null);

    const result = await checkAuth(null, environmentId, mockRequest);

    expect(authenticateRequest).toHaveBeenCalledWith(mockRequest);
    expect(responses.notAuthenticatedResponse).toHaveBeenCalled();
    expect(result).toBe(mockNotAuthenticatedResponse);
  });

  test("returns unauthorizedResponse when no session and authentication lacks POST permission", async () => {
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

    vi.mocked(authenticateRequest).mockResolvedValue(mockAuthentication);
    vi.mocked(hasPermission).mockReturnValue(false);

    const result = await checkAuth(null, environmentId, mockRequest);

    expect(authenticateRequest).toHaveBeenCalledWith(mockRequest);
    expect(hasPermission).toHaveBeenCalledWith(
      mockAuthentication.environmentPermissions,
      environmentId,
      "POST"
    );
    expect(responses.unauthorizedResponse).toHaveBeenCalled();
    expect(result).toBe(mockUnauthorizedResponse);
  });

  test("returns undefined when no session and authentication has POST permission", async () => {
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

    vi.mocked(authenticateRequest).mockResolvedValue(mockAuthentication);
    vi.mocked(hasPermission).mockReturnValue(true);

    const result = await checkAuth(null, environmentId, mockRequest);

    expect(authenticateRequest).toHaveBeenCalledWith(mockRequest);
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

    const result = await checkAuth(mockSession, environmentId, mockRequest);

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

    const result = await checkAuth(mockSession, environmentId, mockRequest);

    expect(hasUserEnvironmentAccess).toHaveBeenCalledWith("user-123", environmentId);
    expect(result).toBeUndefined();
  });

  test("does not call authenticateRequest when session exists", async () => {
    const mockSession: Session = {
      user: {
        id: "user-123",
      },
      expires: "2024-12-31T23:59:59.999Z",
    };

    vi.mocked(hasUserEnvironmentAccess).mockResolvedValue(true);

    await checkAuth(mockSession, environmentId, mockRequest);

    expect(authenticateRequest).not.toHaveBeenCalled();
    expect(hasUserEnvironmentAccess).toHaveBeenCalledWith("user-123", environmentId);
  });
});
