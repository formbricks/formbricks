import { beforeEach, describe, expect, test, vi } from "vitest";
import { getApiKeyWithPermissions } from "@/modules/organization/settings/api-keys/lib/api-key";
import {
  authenticateApiKeyFromHeaders,
  getApiKeyFromHeaders,
  getBearerTokenFromHeaders,
} from "./api-key-auth";

vi.mock("@/modules/organization/settings/api-keys/lib/api-key", () => ({
  getApiKeyWithPermissions: vi.fn(),
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
  const headers = new Headers({ "x-api-key": "some-key" });

  const apiKey = (
    workspaces: { permission: string; workspaceId: string; workspace: { name: string } }[]
  ) => ({
    id: "key-1",
    organizationId: "org-1",
    organizationAccess: { accessControl: { read: true, write: false } },
    apiKeyWorkspaces: workspaces,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects a revoked or deleted key", async () => {
    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(null as never);
    await expect(authenticateApiKeyFromHeaders(headers)).resolves.toBeNull();
  });

  test("rejects an organization-only key on routes that did not opt in", async () => {
    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(apiKey([]) as never);
    await expect(authenticateApiKeyFromHeaders(headers)).resolves.toBeNull();
  });

  test("accepts an organization-only key when the route opts in", async () => {
    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(apiKey([]) as never);

    const auth = await authenticateApiKeyFromHeaders(headers, { allowOrganizationOnlyApiKey: true });

    expect(auth?.apiKeyId).toBe("key-1");
    expect(auth?.workspacePermissions).toEqual([]);
  });

  test("accepts a workspace-scoped key and maps its grants", async () => {
    vi.mocked(getApiKeyWithPermissions).mockResolvedValue(
      apiKey([{ permission: "read", workspaceId: "ws-1", workspace: { name: "Growth" } }]) as never
    );

    const auth = await authenticateApiKeyFromHeaders(headers);

    expect(auth?.workspacePermissions).toEqual([
      { permission: "read", workspaceId: "ws-1", workspaceName: "Growth" },
    ]);
  });
});
