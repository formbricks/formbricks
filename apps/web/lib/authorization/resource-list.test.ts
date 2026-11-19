import { beforeEach, describe, expect, test, vi } from "vitest";
import { getAuthzedClient } from "@/lib/authzed/client";
import { AUTHZED_ERROR_CODES, AuthzedError } from "@/lib/authzed/errors";
import { assertAuthzedProjectionFreshness } from "@/lib/authzed/outbox-freshness";
import { isSurveyVisibilityReady } from "@/lib/authzed/scope-readiness";
import { getAuthorizationSurface, getMcpGrantForActor, recordAuthorizationCheckIssued } from "./context";
import { recordAuthorizationDecision } from "./metrics";
import {
  filterReadableSurveyIds,
  lookupAuthorizedOrganizationIds,
  lookupAuthorizedWorkspaceIds,
} from "./resource-list";

vi.mock("@/lib/authzed/scope-readiness", () => ({ isSurveyVisibilityReady: vi.fn() }));
vi.mock("@/lib/authzed/client", () => ({ getAuthzedClient: vi.fn() }));
vi.mock("@/lib/authzed/outbox-freshness", () => ({ assertAuthzedProjectionFreshness: vi.fn() }));
vi.mock("./context", () => ({
  getAuthorizationSurface: vi.fn(() => "unscoped"),
  getMcpGrantForActor: vi.fn(() => null),
  recordAuthorizationCheckIssued: vi.fn(),
  recordMcpReachDenied: vi.fn(),
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

describe("survey list graph confirmation", () => {
  test("keeps the SQL-authorized page before the survey baseline exists", async () => {
    vi.mocked(isSurveyVisibilityReady).mockResolvedValue(false);
    await expect(filterReadableSurveyIds({ type: "user", id: "u1" }, ["old-survey"])).resolves.toEqual(
      new Set(["old-survey"])
    );
    expect(getAuthzedClient).not.toHaveBeenCalled();
  });
  test("uses visibility-aware permissions once projection is ready", async () => {
    vi.mocked(isSurveyVisibilityReady).mockResolvedValue(true);
    vi.mocked(assertAuthzedProjectionFreshness).mockResolvedValue(undefined);
    const checkBulkPermissions = vi.fn().mockResolvedValue(new Set(["shared"]));
    vi.mocked(getAuthzedClient).mockReturnValue({ checkBulkPermissions } as never);
    await expect(
      filterReadableSurveyIds({ type: "apiKey", id: "k1" }, ["shared", "private"])
    ).resolves.toEqual(new Set(["shared"]));
    expect(checkBulkPermissions).toHaveBeenCalledWith(expect.objectContaining({ permission: "read_v2" }));
  });
  test("fails closed when readiness cannot be determined", async () => {
    vi.mocked(isSurveyVisibilityReady).mockRejectedValue(new Error("database unavailable"));
    await expect(filterReadableSurveyIds({ type: "user", id: "u1" }, ["private"])).rejects.toThrow(
      "database unavailable"
    );
    expect(getAuthzedClient).not.toHaveBeenCalled();
  });
});

describe("on the previous release's AuthZed schema", () => {
  const failedPrecondition = (details: string) =>
    new AuthzedError({
      attempts: 1,
      cause: Object.assign(new Error(`9 FAILED_PRECONDITION: ${details}`), { code: 9, details }),
      code: AUTHZED_ERROR_CODES.FAILED_PRECONDITION,
      grpcStatus: 9,
      operation: "lookup_resources",
      retryable: false,
    });

  test("lists no workspace for dashboard_read, which that schema does not define", async () => {
    lookupResources.mockRejectedValueOnce(
      failedPrecondition("relation/permission `dashboard_read` not found under definition `workspace`")
    );

    await expect(
      lookupAuthorizedWorkspaceIds({ type: "user", id: "viewer-missing-schema" }, "dashboard_read")
    ).resolves.toEqual([]);
    expect(recordAuthorizationDecision).toHaveBeenCalledWith(expect.objectContaining({ outcome: "deny" }));
  });

  test("still fails on a missing permission the release did not add", async () => {
    lookupResources.mockRejectedValueOnce(
      failedPrecondition("relation/permission `write` not found under definition `workspace`")
    );

    await expect(
      lookupAuthorizedWorkspaceIds({ type: "user", id: "viewer-missing-write" }, "write")
    ).rejects.toBeDefined();
  });
});

describe("under an MCP grant that limits organization & workspace access (ENG-7153)", () => {
  const user = { type: "user", id: "user-1" } as const;

  test("lists only the workspaces the grant reaches, in two lookups", async () => {
    vi.mocked(getMcpGrantForActor).mockReturnValue({ id: "grant-1", userId: "user-1" });
    lookupResources.mockImplementation(async ({ subject }: { subject: { objectType: string } }) => ({
      resourceIds: subject.objectType === "mcp_grant" ? ["ws-2", "ws-3"] : ["ws-1", "ws-2"],
    }));

    await expect(lookupAuthorizedWorkspaceIds(user)).resolves.toEqual(["ws-2"]);

    expect(lookupResources).toHaveBeenCalledTimes(2);
    expect(lookupResources).toHaveBeenCalledWith({
      permission: "mcp_reach",
      resourceType: "workspace",
      subject: { objectId: "grant-1", objectType: "mcp_grant" },
    });
  });

  test("lists nothing on a schema without mcp_reach, rather than everything", async () => {
    vi.mocked(getMcpGrantForActor).mockReturnValue({ id: "grant-1", userId: "user-1" });
    lookupResources.mockImplementation(async ({ subject }: { subject: { objectType: string } }) => {
      if (subject.objectType === "mcp_grant") {
        const details = "relation/permission `mcp_reach` not found under definition `workspace`";
        throw new AuthzedError({
          attempts: 1,
          cause: Object.assign(new Error(`9 FAILED_PRECONDITION: ${details}`), { code: 9, details }),
          code: AUTHZED_ERROR_CODES.FAILED_PRECONDITION,
          grpcStatus: 9,
          operation: "lookup_resources",
          retryable: false,
        });
      }
      return { resourceIds: ["ws-1"] };
    });

    await expect(lookupAuthorizedWorkspaceIds(user)).resolves.toEqual([]);
  });

  test("lists as before for anyone the grant doesn't hold", async () => {
    vi.mocked(getMcpGrantForActor).mockReturnValue(null);
    lookupResources.mockResolvedValue({ resourceIds: ["ws-1"] });

    await expect(lookupAuthorizedWorkspaceIds(user)).resolves.toEqual(["ws-1"]);
    expect(lookupResources).toHaveBeenCalledOnce();
  });
});
