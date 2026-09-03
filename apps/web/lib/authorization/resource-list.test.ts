import { beforeEach, describe, expect, test, vi } from "vitest";
import { getAuthzedClient } from "@/lib/authzed/client";
import { AUTHZED_ERROR_CODES, AuthzedError } from "@/lib/authzed/errors";
import { assertAuthzedProjectionFreshness } from "@/lib/authzed/outbox-freshness";
import { getAuthorizationSurface, recordAuthorizationCheckIssued } from "./context";
import { recordAuthorizationDecision } from "./metrics";
import { lookupAuthorizedOrganizationIds, lookupAuthorizedWorkspaceIds } from "./resource-list";

vi.mock("@/lib/authzed/client", () => ({ getAuthzedClient: vi.fn() }));
vi.mock("@/lib/authzed/outbox-freshness", () => ({ assertAuthzedProjectionFreshness: vi.fn() }));
vi.mock("./context", () => ({
  getAuthorizationSurface: vi.fn(() => "unscoped"),
  recordAuthorizationCheckIssued: vi.fn(),
}));
vi.mock("./metrics", () => ({ recordAuthorizationDecision: vi.fn() }));

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
    expect(recordAuthorizationDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "organization.read",
        actorType: "user",
        outcome: "allow",
        resourceType: "organization",
        surface: "unscoped",
      })
    );
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
    const stale = new AuthzedError({
      attempts: 1,
      code: AUTHZED_ERROR_CODES.PROJECTION_STALE,
      operation: "projection_freshness",
      retryable: false,
    });
    vi.mocked(assertAuthzedProjectionFreshness).mockRejectedValue(stale);

    await expect(lookupAuthorizedWorkspaceIds({ type: "user", id: "user-1" })).rejects.toMatchObject({
      code: AUTHZED_ERROR_CODES.PROJECTION_STALE,
      operation: "authorization_list",
    });
    expect(getAuthzedClient).not.toHaveBeenCalled();
    expect(recordAuthorizationDecision).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: AUTHZED_ERROR_CODES.PROJECTION_STALE,
        outcome: "operational_error",
      })
    );
  });

  test("propagates lookup operational failures without returning a partial list", async () => {
    const unavailable = new Error("AuthZed unavailable");
    lookupResources.mockRejectedValue(unavailable);

    await expect(lookupAuthorizedWorkspaceIds({ type: "user", id: "user-1" })).rejects.toMatchObject({
      code: AUTHZED_ERROR_CODES.INTERNAL,
      operation: "authorization_list",
    });
    expect(recordAuthorizationDecision).toHaveBeenCalledWith(
      expect.objectContaining({ errorCode: AUTHZED_ERROR_CODES.INTERNAL, outcome: "operational_error" })
    );
  });

  test("records an empty authoritative list as an aggregate deny on the active surface", async () => {
    vi.mocked(getAuthorizationSurface).mockReturnValueOnce("mcp");

    await expect(lookupAuthorizedWorkspaceIds({ type: "apiKey", id: "key-1" })).resolves.toEqual([]);

    expect(recordAuthorizationDecision).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "deny", surface: "mcp" })
    );
  });
});
