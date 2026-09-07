import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { getAuthorizedApiKeyWorkspaceIds } from "./authorized-workspace-ids";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/authorization/resource-list", () => ({ lookupAuthorizedWorkspaceIds: vi.fn() }));

const authentication = {
  apiKeyId: "api-key-1",
  organizationAccess: { accessControl: { read: false, write: false } },
  organizationId: "organization-1",
  type: "apiKey",
  workspacePermissions: [
    { permission: "read", workspaceId: "workspace-2", workspaceName: "Two" },
    { permission: "manage", workspaceId: "workspace-1", workspaceName: "One" },
    { permission: "read", workspaceId: "workspace-2", workspaceName: "Two duplicate" },
    { permission: "read", workspaceId: "stale-workspace", workspaceName: "Stale" },
  ],
} as const satisfies TAuthenticationApiKey;

describe("getAuthorizedApiKeyWorkspaceIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the deduplicated intersection of database grants and SpiceDB authorization", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue([
      "workspace-1",
      "workspace-2",
      "unexpected-workspace",
    ]);

    await expect(getAuthorizedApiKeyWorkspaceIds(authentication)).resolves.toEqual([
      "workspace-2",
      "workspace-1",
    ]);
    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledExactlyOnceWith(
      { type: "apiKey", id: "api-key-1" },
      "read"
    );
  });

  test("returns an empty scope when SpiceDB authorizes no workspace", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue([]);

    await expect(getAuthorizedApiKeyWorkspaceIds(authentication)).resolves.toEqual([]);
  });

  test("propagates lookup and projection-freshness failures", async () => {
    const unavailable = new Error("AuthZed unavailable");
    vi.mocked(lookupAuthorizedWorkspaceIds).mockRejectedValue(unavailable);

    await expect(getAuthorizedApiKeyWorkspaceIds(authentication)).rejects.toBe(unavailable);
  });
});
