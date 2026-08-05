import { beforeEach, describe, expect, test, vi } from "vitest";
import { OrganizationAccessType } from "@formbricks/types/api-key";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";
import { can } from "@/lib/authorization";
import { hasApiKeyOrganizationAccess, hasApiKeyWorkspaceAccess } from "./utils";

// These wrappers only translate the legacy signature into a central authorization
// decision; the underlying ladder is covered by lib/authorization/legacy-api-key-access.test.ts.
vi.mock("@/lib/authorization", () => ({ can: vi.fn() }));

const authentication = {
  type: "apiKey",
  apiKeyId: "key-1",
  organizationId: "org-1",
  organizationAccess: { accessControl: { read: true, write: false } },
  workspacePermissions: [],
} as unknown as TAuthenticationApiKey;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(can).mockResolvedValue(true);
});

describe("hasApiKeyWorkspaceAccess", () => {
  test.each([
    ["GET", "workspace.read"],
    ["POST", "workspace.write"],
    ["PUT", "workspace.write"],
    ["PATCH", "workspace.write"],
    ["DELETE", "workspace.manage"],
  ] as const)("maps %s to %s on the workspace", async (method, action) => {
    await hasApiKeyWorkspaceAccess(authentication, "ws-1", method);

    expect(can).toHaveBeenCalledWith({ type: "apiKey", id: "key-1" }, action, {
      type: "workspace",
      id: "ws-1",
    });
  });

  test("returns the central decision", async () => {
    vi.mocked(can).mockResolvedValue(false);
    await expect(hasApiKeyWorkspaceAccess(authentication, "ws-1", "GET")).resolves.toBe(false);
  });

  test("propagates an evaluator failure instead of denying", async () => {
    vi.mocked(can).mockRejectedValue(new Error("db down"));
    await expect(hasApiKeyWorkspaceAccess(authentication, "ws-1", "GET")).rejects.toThrow("db down");
  });
});

describe("hasApiKeyOrganizationAccess", () => {
  test("maps Read to the access-read action on the key's own organization", async () => {
    await hasApiKeyOrganizationAccess(authentication, OrganizationAccessType.Read);

    expect(can).toHaveBeenCalledWith({ type: "apiKey", id: "key-1" }, "organization.read_access", {
      type: "organization",
      id: "org-1",
    });
  });

  test("maps Write to the access-management action", async () => {
    await hasApiKeyOrganizationAccess(authentication, OrganizationAccessType.Write);

    expect(can).toHaveBeenCalledWith({ type: "apiKey", id: "key-1" }, "organization.manage_access", {
      type: "organization",
      id: "org-1",
    });
  });

  test("returns the central decision", async () => {
    vi.mocked(can).mockResolvedValue(false);
    await expect(hasApiKeyOrganizationAccess(authentication, OrganizationAccessType.Read)).resolves.toBe(
      false
    );
  });
});
