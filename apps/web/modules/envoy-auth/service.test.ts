import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { authorizeEnvoyRequest } from "./service";

const {
  mockAuthenticateApiKeyFromHeaders,
  mockGetApiKeyFromHeaders,
  mockGetBearerTokenFromHeaders,
  mockGetProxySession,
  mockVerifyFeedbackRecordsGatewayToken,
  mockGetFeedbackRecordDirectoryAuthContext,
  mockGetFeedbackRecordTenant,
  mockCheckAuthorizationUpdated,
  mockUserFindUnique,
  mockGetIsUnifyFeedbackEnabled,
} = vi.hoisted(() => ({
  mockAuthenticateApiKeyFromHeaders: vi.fn(),
  mockGetApiKeyFromHeaders: vi.fn(),
  mockGetBearerTokenFromHeaders: vi.fn(),
  mockGetProxySession: vi.fn(),
  mockVerifyFeedbackRecordsGatewayToken: vi.fn(),
  mockGetFeedbackRecordDirectoryAuthContext: vi.fn(),
  mockGetFeedbackRecordTenant: vi.fn(),
  mockCheckAuthorizationUpdated: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockGetIsUnifyFeedbackEnabled: vi.fn(),
}));

vi.mock("@/modules/api/lib/api-key-auth", () => ({
  authenticateApiKeyFromHeaders: mockAuthenticateApiKeyFromHeaders,
  getApiKeyFromHeaders: mockGetApiKeyFromHeaders,
  getBearerTokenFromHeaders: mockGetBearerTokenFromHeaders,
}));

vi.mock("@/modules/auth/lib/proxy-session", () => ({
  getProxySession: mockGetProxySession,
}));

vi.mock("@/lib/jwt", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/jwt")>();
  return {
    ...actual,
    verifyFeedbackRecordsGatewayToken: mockVerifyFeedbackRecordsGatewayToken,
  };
});

vi.mock("@formbricks/database", () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}));

vi.mock("@/modules/ee/feedback-record-directory/lib/feedback-record-directory", () => ({
  getFeedbackRecordDirectoryAuthContext: mockGetFeedbackRecordDirectoryAuthContext,
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getIsUnifyFeedbackEnabled: mockGetIsUnifyFeedbackEnabled,
}));

vi.mock("@/modules/hub/service", () => ({
  getFeedbackRecordTenant: mockGetFeedbackRecordTenant,
}));

vi.mock("@/lib/utils/action-client/action-client-middleware", () => ({
  checkAuthorizationUpdated: mockCheckAuthorizationUpdated,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const feedbackRecordDirectoryId = "clxx1234567890123456789012";
const feedbackRecordId = "0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8";

const createRequest = (
  url: string,
  {
    method = "GET",
    headers = {},
    body,
  }: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit;
  } = {}
) =>
  new NextRequest(url, {
    method,
    headers,
    body,
  });

describe("authorizeEnvoyRequest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetApiKeyFromHeaders.mockReturnValue(null);
    mockGetBearerTokenFromHeaders.mockReturnValue(null);
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue(null);
    mockGetProxySession.mockResolvedValue(null);
    mockVerifyFeedbackRecordsGatewayToken.mockImplementation(() => {
      throw new Error("invalid token");
    });
    mockGetFeedbackRecordDirectoryAuthContext.mockResolvedValue({
      organizationId: "org_1",
      workspaceIds: ["workspace_1"],
      isArchived: false,
    });
    mockGetFeedbackRecordTenant.mockResolvedValue({
      data: { tenantId: feedbackRecordDirectoryId },
      error: null,
    });
    mockCheckAuthorizationUpdated.mockResolvedValue(true);
    mockUserFindUnique.mockResolvedValue({ id: "user_1", isActive: true });
    mockGetIsUnifyFeedbackEnabled.mockResolvedValue(true);
  });

  test("allows create requests with an API key and body tenant_id", async () => {
    mockGetApiKeyFromHeaders.mockReturnValue("fbk_test");
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [],
      feedbackRecordDirectoryPermissions: [
        {
          feedbackRecordDirectoryId,
          feedbackRecordDirectoryName: "Directory 1",
          permission: "write",
        },
      ],
    });

    const response = await authorizeEnvoyRequest(
      createRequest("http://localhost/api/envoy-auth/api/v3/feedbackRecords", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer fbk_test",
        },
        body: JSON.stringify({ tenant_id: feedbackRecordDirectoryId }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-envoy-auth-headers-to-remove")).toBe("x-api-key,authorization,cookie");
    expect(mockCheckAuthorizationUpdated).not.toHaveBeenCalled();
  });

  test("returns 400 when bulkDelete is missing tenant_id", async () => {
    mockGetApiKeyFromHeaders.mockReturnValue("fbk_test");
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [],
      feedbackRecordDirectoryPermissions: [],
    });

    const response = await authorizeEnvoyRequest(
      createRequest("http://localhost/api/envoy-auth/v1/feedback-records", {
        method: "DELETE",
        headers: {
          "x-api-key": "fbk_test",
        },
      })
    );

    expect(response.status).toBe(400);
  });

  test("returns 400 for unsupported envoy auth routes", async () => {
    const response = await authorizeEnvoyRequest(
      createRequest("http://localhost/api/envoy-auth/api/v1/test")
    );

    expect(response.status).toBe(400);
  });

  test("returns 403 when record tenant lookup is not found", async () => {
    mockGetApiKeyFromHeaders.mockReturnValue("fbk_test");
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [],
      feedbackRecordDirectoryPermissions: [],
    });
    mockGetFeedbackRecordTenant.mockResolvedValue({
      data: null,
      error: {
        status: 404,
        message: "Not found",
        detail: "Not found",
      },
    });

    const response = await authorizeEnvoyRequest(
      createRequest(`http://localhost/api/envoy-auth/v1/feedback-records/${feedbackRecordId}`, {
        headers: {
          "x-api-key": "fbk_test",
        },
      })
    );

    expect(response.status).toBe(403);
  });

  test("returns 503 when record tenant lookup fails upstream", async () => {
    mockGetApiKeyFromHeaders.mockReturnValue("fbk_test");
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [],
      feedbackRecordDirectoryPermissions: [],
    });
    mockGetFeedbackRecordTenant.mockResolvedValue({
      data: null,
      error: {
        status: 503,
        message: "Upstream failed",
        detail: "Upstream failed",
      },
    });

    const response = await authorizeEnvoyRequest(
      createRequest(`http://localhost/api/envoy-auth/v1/feedback-records/${feedbackRecordId}`, {
        headers: {
          "x-api-key": "fbk_test",
        },
      })
    );

    expect(response.status).toBe(503);
  });

  test("returns 401 for invalid explicit JWT even when a session cookie exists", async () => {
    mockGetBearerTokenFromHeaders.mockReturnValue("header.payload.signature");
    mockGetProxySession.mockResolvedValue({
      userId: "user_1",
    });

    const response = await authorizeEnvoyRequest(
      createRequest(
        `http://localhost/api/envoy-auth/v1/feedback-records?tenant_id=${feedbackRecordDirectoryId}`,
        {
          headers: {
            authorization: "Bearer header.payload.signature",
            cookie: "next-auth.session-token=still-present",
          },
        }
      )
    );

    expect(response.status).toBe(401);
    expect(mockGetProxySession).not.toHaveBeenCalled();
  });

  test("allows PATCH requests with a valid gateway JWT", async () => {
    mockGetBearerTokenFromHeaders.mockReturnValue("header.payload.signature");
    mockVerifyFeedbackRecordsGatewayToken.mockReturnValue({ userId: "user_1" });

    const response = await authorizeEnvoyRequest(
      createRequest(`http://localhost/api/envoy-auth/v1/feedback-records/${feedbackRecordId}`, {
        method: "PATCH",
        headers: {
          authorization: "Bearer header.payload.signature",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(mockCheckAuthorizationUpdated).toHaveBeenCalledWith({
      userId: "user_1",
      organizationId: "org_1",
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          workspaceId: "workspace_1",
          minPermission: "readWrite",
        },
      ],
    });
  });

  test("allows session-authenticated list requests when no explicit credentials are present", async () => {
    mockGetProxySession.mockResolvedValue({
      userId: "user_2",
    });

    const response = await authorizeEnvoyRequest(
      createRequest(
        `http://localhost/api/envoy-auth/v1/feedback-records?tenant_id=${feedbackRecordDirectoryId}`,
        {
          headers: {
            cookie: "next-auth.session-token=valid",
          },
        }
      )
    );

    expect(response.status).toBe(200);
    expect(mockCheckAuthorizationUpdated).toHaveBeenCalledWith({
      userId: "user_2",
      organizationId: "org_1",
      access: [
        {
          type: "organization",
          roles: ["owner", "manager"],
        },
        {
          type: "workspaceTeam",
          workspaceId: "workspace_1",
          minPermission: "read",
        },
      ],
    });
  });

  test("returns 403 when an API key lacks directory permission", async () => {
    mockGetApiKeyFromHeaders.mockReturnValue("fbk_test");
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [],
      feedbackRecordDirectoryPermissions: [],
    });

    const response = await authorizeEnvoyRequest(
      createRequest(
        `http://localhost/api/envoy-auth/v1/feedback-records?tenant_id=${feedbackRecordDirectoryId}`,
        {
          method: "DELETE",
          headers: {
            "x-api-key": "fbk_test",
          },
        }
      )
    );

    expect(response.status).toBe(403);
  });

  test("returns 403 when unify feedback entitlement is disabled", async () => {
    mockGetIsUnifyFeedbackEnabled.mockResolvedValue(false);
    mockGetApiKeyFromHeaders.mockReturnValue("fbk_test");
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [],
      feedbackRecordDirectoryPermissions: [
        {
          feedbackRecordDirectoryId,
          feedbackRecordDirectoryName: "Directory 1",
          permission: "write",
        },
      ],
    });

    const response = await authorizeEnvoyRequest(
      createRequest(
        `http://localhost/api/envoy-auth/v1/feedback-records?tenant_id=${feedbackRecordDirectoryId}`,
        {
          headers: {
            "x-api-key": "fbk_test",
          },
        }
      )
    );

    expect(response.status).toBe(403);
    expect(mockGetIsUnifyFeedbackEnabled).toHaveBeenCalledWith("org_1");
  });

  test("returns 403 for archived directories", async () => {
    mockGetBearerTokenFromHeaders.mockReturnValue("header.payload.signature");
    mockVerifyFeedbackRecordsGatewayToken.mockReturnValue({ userId: "user_1" });
    mockGetFeedbackRecordDirectoryAuthContext.mockResolvedValue({
      organizationId: "org_1",
      workspaceIds: ["workspace_1"],
      isArchived: true,
    });

    const response = await authorizeEnvoyRequest(
      createRequest(
        `http://localhost/api/envoy-auth/v1/feedback-records?tenant_id=${feedbackRecordDirectoryId}`,
        {
          headers: {
            authorization: "Bearer header.payload.signature",
          },
        }
      )
    );

    expect(response.status).toBe(403);
  });

  test("returns 400 for lookalike route prefixes that are not actual feedback-records paths", async () => {
    mockGetApiKeyFromHeaders.mockReturnValue("fbk_test");
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [],
      feedbackRecordDirectoryPermissions: [],
    });

    const response = await authorizeEnvoyRequest(
      createRequest(
        `http://localhost/api/envoy-auth/api/v3/feedbackRecordsFoo?tenant_id=${feedbackRecordDirectoryId}`,
        {
          headers: {
            authorization: "Bearer fbk_test",
          },
        }
      )
    );

    expect(response.status).toBe(400);
  });

  test("handles HEAD requests through the generic service instead of 405ing at Next.js", async () => {
    mockGetApiKeyFromHeaders.mockReturnValue("fbk_test");
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [],
      feedbackRecordDirectoryPermissions: [],
    });

    const response = await authorizeEnvoyRequest(
      createRequest(`http://localhost/api/envoy-auth/v1/feedback-records/${feedbackRecordId}`, {
        method: "HEAD",
        headers: {
          "x-api-key": "fbk_test",
        },
      })
    );

    expect(response.status).toBe(400);
  });

  test("handles OPTIONS requests through the generic service instead of 405ing at Next.js", async () => {
    mockGetApiKeyFromHeaders.mockReturnValue("fbk_test");
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [],
      feedbackRecordDirectoryPermissions: [],
    });

    const response = await authorizeEnvoyRequest(
      createRequest("http://localhost/api/envoy-auth/v1/feedback-records", {
        method: "OPTIONS",
        headers: {
          authorization: "Bearer fbk_test",
        },
      })
    );

    expect(response.status).toBe(400);
  });
});
