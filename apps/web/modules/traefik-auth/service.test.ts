import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { authorizeTraefikRequest } from "./service";

const {
  mockAuthenticateApiKeyFromHeaders,
  mockGetApiKeyFromHeaders,
  mockGetBearerTokenFromHeaders,
  mockGetProxySession,
  mockVerifyFeedbackRecordsGatewayToken,
  mockGetFeedbackDirectoryAuthContext,
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
  mockGetFeedbackDirectoryAuthContext: vi.fn(),
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

vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getFeedbackDirectoryAuthContext: mockGetFeedbackDirectoryAuthContext,
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

const feedbackDirectoryId = "clxx1234567890123456789012";
const feedbackRecordId = "0194d8a0-3d55-7ff4-9f62-8d02c3fbcfe8";

const createRequest = ({
  method = "GET",
  forwardedMethod = "GET",
  forwardedUri,
  headers = {},
  body,
  adapterUrl = "http://localhost/api/traefik-auth/feedback-records",
}: {
  method?: string;
  forwardedMethod?: string;
  forwardedUri?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  adapterUrl?: string;
} = {}) =>
  new NextRequest(adapterUrl, {
    method,
    headers: {
      "x-forwarded-method": forwardedMethod,
      ...(forwardedUri ? { "x-forwarded-uri": forwardedUri } : {}),
      "x-forwarded-host": "app.example.com",
      "x-forwarded-proto": "https",
      ...headers,
    },
    body,
  });

describe("authorizeTraefikRequest", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetApiKeyFromHeaders.mockReturnValue(null);
    mockGetBearerTokenFromHeaders.mockReturnValue(null);
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue(null);
    mockGetProxySession.mockResolvedValue(null);
    mockVerifyFeedbackRecordsGatewayToken.mockImplementation(() => {
      throw new Error("invalid token");
    });
    mockGetFeedbackDirectoryAuthContext.mockResolvedValue({
      organizationId: "org_1",
      workspaceIds: ["workspace_1"],
      isArchived: false,
    });
    mockGetFeedbackRecordTenant.mockResolvedValue({
      data: { tenantId: feedbackDirectoryId },
      error: null,
    });
    mockCheckAuthorizationUpdated.mockResolvedValue(true);
    mockUserFindUnique.mockResolvedValue({ id: "user_1", isActive: true });
    mockGetIsUnifyFeedbackEnabled.mockResolvedValue(true);
  });

  test("allows requests using Traefik forwarded method and URI metadata", async () => {
    mockGetApiKeyFromHeaders.mockReturnValue("fbk_test");
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [],
    });

    const response = await authorizeTraefikRequest(
      createRequest({
        method: "POST",
        forwardedMethod: "POST",
        forwardedUri: "/api/v3/feedbackRecords",
        headers: {
          authorization: "Bearer fbk_test",
          "content-type": "application/json",
        },
        body: JSON.stringify({ tenant_id: feedbackDirectoryId }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-envoy-auth-headers-to-remove")).toBeNull();
  });

  test("uses the forwarded URI instead of the Traefik auth endpoint URL", async () => {
    mockGetApiKeyFromHeaders.mockReturnValue("fbk_test");
    mockAuthenticateApiKeyFromHeaders.mockResolvedValue({
      type: "apiKey",
      apiKeyId: "key_1",
      organizationId: "org_1",
      organizationAccess: { accessControl: { read: true, write: true } },
      workspacePermissions: [],
    });

    const response = await authorizeTraefikRequest(
      createRequest({
        adapterUrl: "http://localhost/api/traefik-auth/not-the-original-route",
        forwardedUri: `/v1/feedback-records?tenant_id=${feedbackDirectoryId}`,
      })
    );

    expect(response.status).toBe(200);
  });

  test("returns 400 when Traefik forwarded metadata is missing", async () => {
    const response = await authorizeTraefikRequest(
      new NextRequest("http://localhost/api/traefik-auth/v1/feedback-records", {
        method: "GET",
      })
    );

    expect(response.status).toBe(400);
  });

  test("authorizes record lookups through the shared FeedbackRecords authorizer", async () => {
    mockGetBearerTokenFromHeaders.mockReturnValue("header.payload.signature");
    mockVerifyFeedbackRecordsGatewayToken.mockReturnValue({ userId: "user_1" });

    const response = await authorizeTraefikRequest(
      createRequest({
        forwardedMethod: "PATCH",
        forwardedUri: `/v1/feedback-records/${feedbackRecordId}`,
        headers: {
          authorization: "Bearer header.payload.signature",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(mockGetFeedbackRecordTenant).toHaveBeenCalledWith(feedbackRecordId);
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

  test("returns 401 for invalid explicit JWT instead of falling back to session cookies", async () => {
    mockGetBearerTokenFromHeaders.mockReturnValue("header.payload.signature");
    mockGetProxySession.mockResolvedValue({
      userId: "user_1",
    });

    const response = await authorizeTraefikRequest(
      createRequest({
        forwardedUri: `/v1/feedback-records?tenant_id=${feedbackDirectoryId}`,
        headers: {
          authorization: "Bearer header.payload.signature",
          cookie: "next-auth.session-token=still-present",
        },
      })
    );

    expect(response.status).toBe(401);
    expect(mockGetProxySession).not.toHaveBeenCalled();
  });
});
