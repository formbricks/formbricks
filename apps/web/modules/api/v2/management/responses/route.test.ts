import { beforeEach, describe, expect, test, vi } from "vitest";
import type { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
// Imported statically rather than with `await import("./route")` inside a test: `vi.mock` is hoisted
// above imports either way, but a dynamic import charges the route graph's first transform to
// whichever test runs first, which on a loaded CI runner exceeded the 5s testTimeout.
import { GET } from "./route";

const {
  mockAuthenticatedApiClient,
  mockGetAuthorizedApiKeyWorkspaceIds,
  mockGetResponses,
  mockHandleApiError,
  mockSuccessResponse,
} = vi.hoisted(() => ({
  mockAuthenticatedApiClient: vi.fn(),
  mockGetAuthorizedApiKeyWorkspaceIds: vi.fn(),
  mockGetResponses: vi.fn(),
  mockHandleApiError: vi.fn(),
  mockSuccessResponse: vi.fn(),
}));

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

vi.mock("@/modules/api/v2/management/lib/authorized-workspace-ids", () => ({
  getAuthorizedApiKeyWorkspaceIds: mockGetAuthorizedApiKeyWorkspaceIds,
}));

vi.mock("./lib/response", () => ({
  createResponseWithQuotaEvaluation: vi.fn(),
  getResponses: mockGetResponses,
}));

vi.mock("@/app/lib/pipelines", () => ({
  sendToPipeline: vi.fn(),
}));

// Not an identity stub: the success case asserts the *rewritten* value, so the test fails if the
// route stops piping each row's data through this.
vi.mock("@/modules/storage/utils", () => ({
  resolveStorageUrlsInObject: (data: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        value === "storage://private/file.png" ? "https://cdn.example.com/file.png" : value,
      ])
    ),
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
            workspacePermissions: [
              { workspaceId: "ws123", workspaceName: "Test Workspace", permission: "read" },
            ],
            organizationAccess: { accessControl: { read: true, write: true } },
          },
          parsedInput: { query },
        })
    );
    mockHandleApiError.mockImplementation((_request, error) => Response.json({ error }, { status: 400 }));
    mockSuccessResponse.mockImplementation((body: unknown) => Response.json(body, { status: 200 }));
    mockGetAuthorizedApiKeyWorkspaceIds.mockResolvedValue(["ws123"]);
  });

  test("returns the pagination meta the service computed alongside the data", async () => {
    mockGetResponses.mockResolvedValue({
      ok: true,
      data: {
        data: [{ id: "res1", data: { q1: "a", upload: "storage://private/file.png" } }],
        meta: { total: 137, limit: 2, offset: 10 },
      },
    });

    const response = await GET(buildRequest() as any);
    const body = await response.json();

    expect(mockGetAuthorizedApiKeyWorkspaceIds).toHaveBeenCalledWith(
      expect.objectContaining({ apiKeyId: "apiKey123" })
    );
    expect(mockGetResponses).toHaveBeenCalledWith(["ws123"], query);
    expect(response.status).toBe(200);
    expect(body).toEqual({
      data: [{ id: "res1", data: { q1: "a", upload: "https://cdn.example.com/file.png" } }],
      meta: { total: 137, limit: 2, offset: 10 },
    });
  });

  test("surfaces the service error instead of an envelope", async () => {
    mockGetResponses.mockResolvedValue({
      ok: false,
      error: { type: "internal_server_error", details: [{ field: "responses", issue: "boom" }] },
    });

    const response = await GET(buildRequest() as any);

    expect(mockSuccessResponse).not.toHaveBeenCalled();
    expect(mockHandleApiError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: "internal_server_error" })
    );
    expect(response.status).toBe(400);
  });
});
