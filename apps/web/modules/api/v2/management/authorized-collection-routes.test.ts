import { beforeEach, describe, expect, test, vi } from "vitest";
import type { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { getContactAttributeKeys } from "./contact-attribute-keys/lib/contact-attribute-key";
import { GET as getContactAttributeKeysRoute } from "./contact-attribute-keys/route";
import { getAuthorizedApiKeyWorkspaceIds } from "./lib/authorized-workspace-ids";
import { getResponses } from "./responses/lib/response";
import { GET as getResponsesRoute } from "./responses/route";
import { getWebhooks } from "./webhooks/lib/webhook";
import { GET as getWebhooksRoute } from "./webhooks/route";

const { mockAuthenticatedApiClient, mockSuccessResponse } = vi.hoisted(() => ({
  mockAuthenticatedApiClient: vi.fn(),
  mockSuccessResponse: vi.fn(),
}));

vi.mock("@/modules/api/v2/auth/authenticated-api-client", () => ({
  authenticatedApiClient: mockAuthenticatedApiClient,
}));
vi.mock("@/app/lib/pipelines", () => ({ sendToPipeline: vi.fn() }));
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));
vi.mock("@/lib/authorization/permission-action", () => ({
  getWorkspaceAuthorizationActionForMethod: vi.fn(),
}));
vi.mock("@/lib/workspace/service", () => ({ getWorkspaceLegacyStoragePrefixes: vi.fn() }));
vi.mock("@/modules/api/lib/validation", () => ({
  formatValidationErrorsForV2Api: vi.fn(),
  validateResponseData: vi.fn(),
}));
vi.mock("@/modules/api/v2/lib/element", () => ({
  validateOtherOptionLengthForMultipleChoice: vi.fn(),
}));
vi.mock("@/modules/api/v2/lib/response", () => ({
  responses: { successResponse: mockSuccessResponse },
}));
vi.mock("@/modules/api/v2/lib/utils", () => ({ handleApiError: vi.fn() }));
vi.mock("@/modules/ee/license-check/lib/contacts-api-guard", () => ({
  checkContactsEnabledApiV2: vi.fn(),
}));
vi.mock("@/modules/api/v2/management/lib/helper", () => ({
  getWorkspaceId: vi.fn(),
  getWorkspaceIdFromSurveyIds: vi.fn(),
}));
vi.mock("@/modules/api/v2/management/lib/workspace-resolver", () => ({ resolveBodyIdsV2: vi.fn() }));
vi.mock("@/modules/api/v2/management/responses/[responseId]/lib/response", () => ({
  getResponseForPipeline: vi.fn(),
}));
vi.mock("@/modules/api/v2/management/responses/[responseId]/lib/survey", () => ({
  getSurveyQuestions: vi.fn(),
}));
vi.mock("./lib/authorized-workspace-ids", () => ({ getAuthorizedApiKeyWorkspaceIds: vi.fn() }));
vi.mock("./contact-attribute-keys/lib/contact-attribute-key", () => ({
  createContactAttributeKey: vi.fn(),
  getContactAttributeKeys: vi.fn(),
}));
vi.mock("./responses/lib/response", () => ({
  createResponseWithQuotaEvaluation: vi.fn(),
  getResponses: vi.fn(),
}));
vi.mock("./webhooks/lib/webhook", () => ({ createWebhook: vi.fn(), getWebhooks: vi.fn() }));
vi.mock("@/modules/storage/utils", () => ({
  resolveStorageUrlsInObject: vi.fn((value) => value),
  validateClientFileUploads: vi.fn(),
}));

const authentication = {
  apiKeyId: "api-key-1",
  organizationAccess: { accessControl: { read: false, write: false } },
  organizationId: "organization-1",
  type: "apiKey",
  workspacePermissions: [{ permission: "read", workspaceId: "stale-workspace", workspaceName: "Stale" }],
} as const;

const request = new Request("http://localhost/api/v2/management");

describe("API v2 collection authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedApiClient.mockImplementation(
      async ({ handler }: Parameters<typeof authenticatedApiClient>[0]) =>
        handler({ authentication, parsedInput: { query: {} }, request } as never)
    );
    vi.mocked(getAuthorizedApiKeyWorkspaceIds).mockResolvedValue(["authorized-workspace"]);
    vi.mocked(getResponses).mockResolvedValue({ ok: true, data: { data: [] } } as never);
    vi.mocked(getContactAttributeKeys).mockResolvedValue({ ok: true, data: [] } as never);
    vi.mocked(getWebhooks).mockResolvedValue({ ok: true, data: [] } as never);
    mockSuccessResponse.mockImplementation((body: unknown) => Response.json(body));
  });

  test.each([
    ["responses", getResponsesRoute, getResponses],
    ["contact attribute keys", getContactAttributeKeysRoute, getContactAttributeKeys],
    ["webhooks", getWebhooksRoute, getWebhooks],
  ] as const)(
    "scopes %s collection reads to the authoritative workspace intersection",
    async (_, route, read) => {
      await route(request as never);

      expect(getAuthorizedApiKeyWorkspaceIds).toHaveBeenCalledExactlyOnceWith(authentication);
      expect(read).toHaveBeenCalledWith(["authorized-workspace"], expect.anything());
      expect(read).not.toHaveBeenCalledWith(["stale-workspace"], expect.anything());
    }
  );

  test.each([
    ["responses", getResponsesRoute, getResponses],
    ["contact attribute keys", getContactAttributeKeysRoute, getContactAttributeKeys],
    ["webhooks", getWebhooksRoute, getWebhooks],
  ] as const)("does not query %s when the authoritative lookup fails", async (_, route, read) => {
    const unavailable = new Error("AuthZed unavailable");
    vi.mocked(getAuthorizedApiKeyWorkspaceIds).mockRejectedValue(unavailable);

    await expect(route(request as never)).rejects.toBe(unavailable);
    expect(read).not.toHaveBeenCalled();
  });
});
