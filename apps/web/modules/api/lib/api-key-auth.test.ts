import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  authenticateApiKeyFromHeaders,
  getApiKeyFromHeaders,
  getBearerTokenFromHeaders,
} from "./api-key-auth";

const mocks = vi.hoisted(() => ({ getApiKeyWithPermissions: vi.fn() }));

vi.mock("@/modules/organization/settings/api-keys/lib/api-key", () => ({
  getApiKeyWithPermissions: mocks.getApiKeyWithPermissions,
}));

describe("api-key-auth helpers", () => {
  test("prefers x-api-key over bearer authorization", () => {
    const headers = new Headers({
      "x-api-key": "fbk_from_header",
      authorization: "Bearer fbk_from_bearer",
    });

    expect(getApiKeyFromHeaders(headers)).toBe("fbk_from_header");
  });

  test("extracts bearer API keys", () => {
    const headers = new Headers({
      authorization: "Bearer fbk_from_bearer",
    });

    expect(getApiKeyFromHeaders(headers)).toBe("fbk_from_bearer");
    expect(getBearerTokenFromHeaders(headers)).toBe("fbk_from_bearer");
  });

  test("does not treat jwt-shaped bearer tokens as API keys", () => {
    const headers = new Headers({
      authorization: "Bearer header.payload.signature",
    });

    expect(getApiKeyFromHeaders(headers)).toBeNull();
    expect(getBearerTokenFromHeaders(headers)).toBe("header.payload.signature");
  });

  test("does not treat opaque bearer tokens as API keys", () => {
    const headers = new Headers({
      authorization: "Bearer opaque_service_token",
    });

    expect(getApiKeyFromHeaders(headers)).toBeNull();
    expect(getBearerTokenFromHeaders(headers)).toBe("opaque_service_token");
  });
});

describe("authenticateApiKeyFromHeaders — ENG-1749 cross-org permission filter", () => {
  const headers = new Headers({ "x-api-key": "fbk_secret" });

  const apiKeyData = (workspaces: unknown[]) => ({
    id: "key1",
    organizationId: "org-self",
    organizationAccess: { accessControl: { read: false, write: false } },
    apiKeyWorkspaces: workspaces,
  });

  const ws = (id: string, organizationId: string) => ({
    permission: "manage",
    workspaceId: id,
    workspace: { id, name: id, organizationId },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("drops workspace permissions whose workspace is in another organization", async () => {
    mocks.getApiKeyWithPermissions.mockResolvedValue(
      apiKeyData([ws("ws-own", "org-self"), ws("ws-victim", "org-other")])
    );

    const auth = await authenticateApiKeyFromHeaders(headers);

    expect(auth?.workspacePermissions).toEqual([
      { permission: "manage", workspaceId: "ws-own", workspaceName: "ws-own" },
    ]);
  });

  test("returns null when only cross-org permissions remain", async () => {
    mocks.getApiKeyWithPermissions.mockResolvedValue(apiKeyData([ws("ws-victim", "org-other")]));

    expect(await authenticateApiKeyFromHeaders(headers)).toBeNull();
  });

  test("keeps a cross-org-only key for org-scoped routes but with no workspace permissions", async () => {
    mocks.getApiKeyWithPermissions.mockResolvedValue(apiKeyData([ws("ws-victim", "org-other")]));

    const auth = await authenticateApiKeyFromHeaders(headers, { allowOrganizationOnlyApiKey: true });

    expect(auth).not.toBeNull();
    expect(auth?.workspacePermissions).toEqual([]);
  });
});
