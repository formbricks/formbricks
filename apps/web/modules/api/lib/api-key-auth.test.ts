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

describe("authenticateApiKeyFromHeaders", () => {
  const headers = new Headers({ "x-api-key": "fbk_secret" });

  const apiKeyData = (workspaces: unknown[]) => ({
    id: "key-1",
    organizationId: "org-1",
    organizationAccess: { accessControl: { read: true, write: false } },
    apiKeyWorkspaces: workspaces,
  });

  const workspaceGrant = (
    id: string,
    organizationId = "org-1",
    permission: "read" | "write" | "manage" = "manage",
    name = id
  ) => ({
    permission,
    workspaceId: id,
    workspace: { id, name, organizationId },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects a revoked or deleted key", async () => {
    mocks.getApiKeyWithPermissions.mockResolvedValue(null);
    await expect(authenticateApiKeyFromHeaders(headers)).resolves.toBeNull();
  });

  test("rejects an organization-only key on routes that did not opt in", async () => {
    mocks.getApiKeyWithPermissions.mockResolvedValue(apiKeyData([]));
    await expect(authenticateApiKeyFromHeaders(headers)).resolves.toBeNull();
  });

  test("accepts an organization-only key when the route opts in", async () => {
    mocks.getApiKeyWithPermissions.mockResolvedValue(apiKeyData([]));

    const auth = await authenticateApiKeyFromHeaders(headers, { allowOrganizationOnlyApiKey: true });

    expect(auth?.apiKeyId).toBe("key-1");
    expect(auth?.workspacePermissions).toEqual([]);
  });

  test("accepts a workspace-scoped key and maps its grants", async () => {
    mocks.getApiKeyWithPermissions.mockResolvedValue(
      apiKeyData([workspaceGrant("ws-1", "org-1", "read", "Growth")])
    );

    const auth = await authenticateApiKeyFromHeaders(headers);

    expect(auth?.workspacePermissions).toEqual([
      { permission: "read", workspaceId: "ws-1", workspaceName: "Growth" },
    ]);
  });

  test("drops workspace permissions whose workspace is in another organization", async () => {
    mocks.getApiKeyWithPermissions.mockResolvedValue(
      apiKeyData([workspaceGrant("ws-own"), workspaceGrant("ws-victim", "org-other")])
    );

    const auth = await authenticateApiKeyFromHeaders(headers);

    expect(auth?.workspacePermissions).toEqual([
      { permission: "manage", workspaceId: "ws-own", workspaceName: "ws-own" },
    ]);
  });

  test("returns null when only cross-org permissions remain", async () => {
    mocks.getApiKeyWithPermissions.mockResolvedValue(apiKeyData([workspaceGrant("ws-victim", "org-other")]));

    expect(await authenticateApiKeyFromHeaders(headers)).toBeNull();
  });

  test("keeps a cross-org-only key for org-scoped routes but with no workspace permissions", async () => {
    mocks.getApiKeyWithPermissions.mockResolvedValue(apiKeyData([workspaceGrant("ws-victim", "org-other")]));

    const auth = await authenticateApiKeyFromHeaders(headers, { allowOrganizationOnlyApiKey: true });

    expect(auth).not.toBeNull();
    expect(auth?.workspacePermissions).toEqual([]);
  });
});
