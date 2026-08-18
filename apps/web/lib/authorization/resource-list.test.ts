import { beforeEach, describe, expect, test, vi } from "vitest";
import { getAuthzedClient } from "@/lib/authzed/client";
import { assertAuthzedProjectionFreshness } from "@/lib/authzed/outbox-freshness";
import { recordAuthorizationCheckIssued } from "./context";
import { lookupAuthorizedOrganizationIds, lookupAuthorizedWorkspaceIds } from "./resource-list";

vi.mock("@/lib/authzed/client", () => ({ getAuthzedClient: vi.fn() }));
vi.mock("@/lib/authzed/outbox-freshness", () => ({ assertAuthzedProjectionFreshness: vi.fn() }));
vi.mock("./context", () => ({ recordAuthorizationCheckIssued: vi.fn() }));

const lookupResources = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthzedClient).mockReturnValue({ lookupResources } as never);
  lookupResources.mockResolvedValue({ resourceIds: [] });
});

describe("authoritative resource lists", () => {
  test("looks up readable organizations for a user after the freshness guard", async () => {
    lookupResources.mockResolvedValue({ resourceIds: ["organization-1"] });

    await expect(lookupAuthorizedOrganizationIds({ type: "user", id: "user-1" })).resolves.toEqual([
      "organization-1",
    ]);

    expect(assertAuthzedProjectionFreshness).toHaveBeenCalledOnce();
    expect(recordAuthorizationCheckIssued).toHaveBeenCalledOnce();
    expect(lookupResources).toHaveBeenCalledExactlyOnceWith({
      permission: "read",
      resourceType: "organization",
      subject: { objectId: "user-1", objectType: "user" },
    });
  });

  test.each(["read", "write"] as const)(
    "looks up %s workspaces for an API key using the mapped object type",
    async (permission) => {
      lookupResources.mockResolvedValue({ resourceIds: ["workspace-1", "workspace-2"] });

      await expect(
        lookupAuthorizedWorkspaceIds({ type: "apiKey", id: "key-1" }, permission)
      ).resolves.toEqual(["workspace-1", "workspace-2"]);

      expect(lookupResources).toHaveBeenCalledExactlyOnceWith({
        permission,
        resourceType: "workspace",
        subject: { objectId: "key-1", objectType: "api_key" },
      });
    }
  );

  test("fails closed before lookup when projection freshness cannot be established", async () => {
    const stale = new Error("stale projection");
    vi.mocked(assertAuthzedProjectionFreshness).mockRejectedValue(stale);

    await expect(lookupAuthorizedWorkspaceIds({ type: "user", id: "user-1" })).rejects.toBe(stale);
    expect(getAuthzedClient).not.toHaveBeenCalled();
  });

  test("propagates lookup operational failures without returning a partial list", async () => {
    const unavailable = new Error("AuthZed unavailable");
    lookupResources.mockRejectedValue(unavailable);

    await expect(lookupAuthorizedWorkspaceIds({ type: "user", id: "user-1" })).rejects.toBe(unavailable);
  });
});
