import { beforeEach, describe, expect, test, vi } from "vitest";
import type { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";

const { mockAuthenticatedApiClient, mockGetResponses, mockHandleApiError, mockSuccessResponse } = vi.hoisted(
  () => ({
    mockAuthenticatedApiClient: vi.fn(),
    mockGetResponses: vi.fn(),
    mockHandleApiError: vi.fn(),
    mockSuccessResponse: vi.fn(),
  })
);

vi.mock("@/modules/api/v2/auth/authenticated-api-client", () => ({
  authenticatedApiClient: mockAuthenticatedApiClient,
}));

vi.mock("@/modules/api/v2/lib/response", () => ({
  responses: {
    createdResponse: mockSuccessResponse,
    successResponse: mockSuccessResponse,
  },
}));

vi.mock("@/modules/api/v2/lib/utils", () => ({
  handleApiError: mockHandleApiError,
}));

vi.mock("./lib/response", () => ({
  createResponseWithQuotaEvaluation: vi.fn(),
  getResponses: mockGetResponses,
}));

vi.mock("@/app/lib/pipelines", () => ({
  sendToPipeline: vi.fn(),
}));

vi.mock("@/modules/storage/utils", () => ({
  resolveStorageUrlsInObject: (data: unknown) => data,
  validateClientFileUploads: vi.fn(),
}));

const query = { limit: 2, skip: 10, sortBy: "createdAt", order: "desc" } as const;

const buildRequest = () => new Request("http://localhost/api/v2/management/responses?limit=2&skip=10");

describe("GET /management/responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuthenticatedApiClient.mockImplementation(
      async ({ handler }: Parameters<typeof authenticatedApiClient>[0]) =>
        await handler({
          request: buildRequest(),
          auditLog: undefined,
          authentication: {
            type: "apiKey",
            apiKeyId: "apiKey123",
            organizationId: "org123",
            workspacePermissions: [{ workspaceId: "ws123", permission: "read", workspaceType: "production" }],
            organizationAccess: { accessControl: { read: true, write: true } },
          },
          parsedInput: { query },
        })
    );
    mockHandleApiError.mockImplementation((_request, error) => Response.json({ error }, { status: 400 }));
    mockSuccessResponse.mockImplementation((body: unknown) => Response.json(body, { status: 200 }));
  });

  test("returns the pagination meta the service computed alongside the data", async () => {
    mockGetResponses.mockResolvedValue({
      ok: true,
      data: {
        data: [{ id: "res1", data: { q1: "a" } }],
        meta: { total: 137, limit: 2, offset: 10 },
      },
    });

    const { GET } = await import("./route");
    const response = await GET(buildRequest() as any);
    const body = await response.json();

    expect(mockGetResponses).toHaveBeenCalledWith(["ws123"], query);
    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: [{ id: "res1", data: { q1: "a" } }],
      meta: { total: 137, limit: 2, offset: 10 },
    });
  });

  test("surfaces the service error instead of an envelope", async () => {
    mockGetResponses.mockResolvedValue({
      ok: false,
      error: { type: "internal_server_error", details: [{ field: "responses", issue: "boom" }] },
    });

    const { GET } = await import("./route");
    const response = await GET(buildRequest() as any);

    expect(mockSuccessResponse).not.toHaveBeenCalled();
    expect(mockHandleApiError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "internal_server_error" })
    );
    expect(response.status).toBe(400);
  });
});
