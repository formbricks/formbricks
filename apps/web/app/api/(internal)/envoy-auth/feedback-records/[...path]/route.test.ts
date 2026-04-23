import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET, POST } from "./route";

const {
  mockAuthenticateApiKeyFromHeaders,
  mockGetApiKeyFromHeaders,
  mockGetFeedbackRecordsGatewayJwtFromHeaders,
  mockGetProxySession,
  mockVerifyFeedbackRecordsGatewayToken,
  mockGetFeedbackRecordDirectoryAuthContext,
  mockGetFeedbackRecordTenant,
  mockCheckAuthorizationUpdated,
  mockUserFindUnique,
} = vi.hoisted(() => ({
  mockAuthenticateApiKeyFromHeaders: vi.fn(),
  mockGetApiKeyFromHeaders: vi.fn(),
  mockGetFeedbackRecordsGatewayJwtFromHeaders: vi.fn(),
  mockGetProxySession: vi.fn(),
  mockVerifyFeedbackRecordsGatewayToken: vi.fn(),
  mockGetFeedbackRecordDirectoryAuthContext: vi.fn(),
  mockGetFeedbackRecordTenant: vi.fn(),
  mockCheckAuthorizationUpdated: vi.fn(),
  mockUserFindUnique: vi.fn(),
}));

vi.mock("@/modules/api/lib/api-key-auth", () => ({
  authenticateApiKeyFromHeaders: mockAuthenticateApiKeyFromHeaders,
  getApiKeyFromHeaders: mockGetApiKeyFromHeaders,
  getFeedbackRecordsGatewayJwtFromHeaders: mockGetFeedbackRecordsGatewayJwtFromHeaders,
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

describe("FeedbackRecords envoy auth route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockGetApiKeyFromHeaders.mockReturnValue(null);
    mockGetFeedbackRecordsGatewayJwtFromHeaders.mockReturnValue(null);
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

    const response = await POST(
      createRequest("http://localhost/api/envoy-auth/feedback-records/api/v3/feedbackRecords", {
        method: "POST",
        headers: {
          method: "POST",
          path: "/api/v3/feedbackRecords",
          "content-type": "application/json",
          authorization: "Bearer fbk_test",
        },
        body: JSON.stringify({ tenant_id: feedbackRecordDirectoryId }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-envoy-auth-headers-to-remove")).toBe("x-api-key,cookie");
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

    const response = await GET(
      createRequest("http://localhost/api/envoy-auth/feedback-records/v1/feedback-records", {
        method: "DELETE",
        headers: {
          method: "DELETE",
          path: "/v1/feedback-records",
          "x-api-key": "fbk_test",
        },
      })
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

    const response = await GET(
      createRequest(`http://localhost/api/envoy-auth/feedback-records/v1/feedback-records/${feedbackRecordId}`, {
        headers: {
          method: "GET",
          path: `/v1/feedback-records/${feedbackRecordId}`,
          "x-api-key": "fbk_test",
        },
      })
    );

    expect(response.status).toBe(403);
  });

  test("returns 401 for invalid explicit JWT even when a session cookie exists", async () => {
    mockGetFeedbackRecordsGatewayJwtFromHeaders.mockReturnValue("header.payload.signature");
    mockGetProxySession.mockResolvedValue({
      userId: "user_1",
    });

    const response = await GET(
      createRequest("http://localhost/api/envoy-auth/feedback-records/v1/feedback-records", {
        headers: {
          method: "GET",
          path: `/v1/feedback-records?tenant_id=${feedbackRecordDirectoryId}`,
          authorization: "Bearer header.payload.signature",
          cookie: "next-auth.session-token=still-present",
        },
      })
    );

    expect(response.status).toBe(401);
    expect(mockGetProxySession).not.toHaveBeenCalled();
  });

  test("returns 403 for archived directories", async () => {
    mockGetFeedbackRecordsGatewayJwtFromHeaders.mockReturnValue("header.payload.signature");
    mockVerifyFeedbackRecordsGatewayToken.mockReturnValue({ userId: "user_1" });
    mockGetFeedbackRecordDirectoryAuthContext.mockResolvedValue({
      organizationId: "org_1",
      workspaceIds: ["workspace_1"],
      isArchived: true,
    });

    const response = await GET(
      createRequest("http://localhost/api/envoy-auth/feedback-records/v1/feedback-records", {
        headers: {
          method: "GET",
          path: `/v1/feedback-records?tenant_id=${feedbackRecordDirectoryId}`,
          authorization: "Bearer header.payload.signature",
        },
      })
    );

    expect(response.status).toBe(403);
  });
});
