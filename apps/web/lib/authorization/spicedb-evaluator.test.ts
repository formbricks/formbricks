import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { getAuthzedClient } from "@/lib/authzed/client";
import { AUTHZED_ERROR_CODES, AuthzedError } from "@/lib/authzed/errors";
import { getMcpGrantForActor } from "./context";
import { AUTHORIZATION_PERMISSION_MAP, type TAuthorizationAction } from "./contract";
import { resolveAuthorizationScope } from "./source-scope";
import { checkSpicedbPermissionAtScope, spicedbEvaluator } from "./spicedb-evaluator";

const constantsMock = vi.hoisted(() => ({ minimumRole: "manager" }));

vi.mock("@/lib/constants", () => ({
  get USER_MANAGEMENT_MINIMUM_ROLE() {
    return constantsMock.minimumRole;
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn() } }));
vi.mock("@/lib/authzed/client", () => ({ getAuthzedClient: vi.fn() }));
vi.mock("@/lib/authzed/outbox-freshness", () => ({ assertAuthzedProjectionFreshness: vi.fn() }));
vi.mock("./source-scope", () => ({ resolveAuthorizationScope: vi.fn() }));
vi.mock("./context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./context")>()),
  getMcpGrantForActor: vi.fn(() => null),
}));

const checkPermission = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  constantsMock.minimumRole = "manager";
  vi.mocked(getAuthzedClient).mockReturnValue({ checkPermission } as never);
  vi.mocked(resolveAuthorizationScope).mockImplementation(async (_actor, resource) => ({
    actorValid: true,
    organizationId: "org-1",
    permissionResource:
      resource.type === "survey" ||
      resource.type === "dashboard" ||
      resource.type === "dashboardPage" ||
      resource.type === "response"
        ? { type: "workspace", id: "workspace-1" }
        : resource.type === "feedbackDirectoryAssignment"
          ? { type: resource.type, id: "assignment-1" }
          : resource,
  }));
  checkPermission.mockResolvedValue({ allowed: true });
});

describe("spicedbEvaluator", () => {
  test("maps every current action for both actor types to its resource and SpiceDB permission", async () => {
    for (const actorType of ["user", "apiKey"] as const) {
      for (const [resourceType, permissions] of Object.entries(AUTHORIZATION_PERMISSION_MAP)) {
        for (const permission of permissions) {
          checkPermission.mockClear();
          const action = `${resourceType}.${permission}` as TAuthorizationAction;

          const resource =
            resourceType === "feedbackDirectoryAssignment"
              ? {
                  type: resourceType,
                  feedbackDirectoryId: "directory-1",
                  workspaceId: "workspace-1",
                }
              : { type: resourceType, id: "resource-1" };

          // No workspace permission stands in for it, so on the workspace node it is denied outright.
          // `dashboard#manage_access` admits users only, so an API key is never asked.
          if (
            action === "survey.change_visibility" ||
            (action === "dashboard.manage_access" && actorType === "apiKey")
          ) {
            await expect(
              spicedbEvaluator.can({ type: actorType, id: "actor-1" }, action, resource as never)
            ).resolves.toBe(false);
            expect(checkPermission).not.toHaveBeenCalled();
            continue;
          }

          await expect(
            spicedbEvaluator.can({ type: actorType, id: "actor-1" }, action, resource as never)
          ).resolves.toBe(true);

          const derivedPermission = {
            "dashboard.manage_access": "administer",
            "dashboard.read": "read",
            "dashboard.write": "write",
            "dashboardPage.read": "read",
            "response.export": "read",
            "response.manage": "manage",
            "response.read": "read",
            "response.write": "write",
            "survey.delete": "write",
            "survey.manage": "manage",
            "survey.publish": "write",
            "survey.read": "read",
            "survey.response_export": "read",
            "survey.response_read": "read",
            "survey.write": "write",
          } as const;
          const isDerived = action in derivedPermission;
          expect(checkPermission).toHaveBeenCalledWith({
            permission: isDerived ? derivedPermission[action as keyof typeof derivedPermission] : permission,
            resource: isDerived
              ? { objectId: "workspace-1", objectType: "workspace" }
              : {
                  objectId: resourceType === "feedbackDirectoryAssignment" ? "assignment-1" : "resource-1",
                  objectType:
                    resourceType === "apiKey"
                      ? "api_key"
                      : resourceType === "feedbackDirectory"
                        ? "feedback_directory"
                        : resourceType === "feedbackDirectoryAssignment"
                          ? "feedback_directory_assignment"
                          : resourceType,
                },
            subject: { objectId: "actor-1", objectType: actorType === "apiKey" ? "api_key" : "user" },
          });
        }
      }
    }
  });

  // ADR-0060: a Dashboard Viewer's dashboard and page reads are decided on the projected node, beside the
  // workspace read that answers everyone else without waiting for the projection.
  describe("dashboard and page reads on the projected node", () => {
    const checkPermissionBatch = vi.fn();
    const scope = (projectedNode: { id: string; type: "dashboard" | "dashboardPage" }) => ({
      actorValid: true,
      organizationId: "org-1",
      permissionResource: { type: "workspace" as const, id: "workspace-1" },
      projectedNode,
    });

    beforeEach(() => {
      vi.mocked(getAuthzedClient).mockReturnValue({ checkPermission, checkPermissionBatch } as never);
    });

    test.each([
      ["dashboard.read", "dashboard", "dashboard"],
      ["dashboardPage.read", "dashboardPage", "dashboard_page"],
    ] as const)(
      "%s asks the workspace read and the node read in one request",
      async (action, type, objectType) => {
        checkPermissionBatch.mockResolvedValue([false, true]);

        await expect(
          checkSpicedbPermissionAtScope(
            { type: "user", id: "viewer-1" },
            action,
            { type, id: "node-1" },
            scope({ type, id: "node-1" })
          )
        ).resolves.toBe(true);

        expect(checkPermission).not.toHaveBeenCalled();
        expect(checkPermissionBatch).toHaveBeenCalledExactlyOnceWith([
          {
            permission: "read",
            resource: { objectId: "workspace-1", objectType: "workspace" },
            subject: { objectId: "viewer-1", objectType: "user" },
          },
          {
            permission: "read",
            resource: { objectId: "node-1", objectType },
            subject: { objectId: "viewer-1", objectType: "user" },
          },
        ]);
      }
    );

    test("denies when neither the workspace nor the node allows", async () => {
      checkPermissionBatch.mockResolvedValue([false, false]);

      await expect(
        checkSpicedbPermissionAtScope(
          { type: "user", id: "viewer-1" },
          "dashboardPage.read",
          { type: "dashboardPage", id: "page-1" },
          scope({ type: "dashboardPage", id: "page-1" })
        )
      ).resolves.toBe(false);
    });

    test("under an MCP grant, the grant must reach the workspace as well", async () => {
      vi.mocked(getMcpGrantForActor).mockReturnValueOnce({ id: "grant-1" } as never);
      checkPermissionBatch.mockResolvedValue([false, true, false]);

      await expect(
        checkSpicedbPermissionAtScope(
          { type: "user", id: "viewer-1" },
          "dashboard.read",
          { type: "dashboard", id: "dash-1" },
          scope({ type: "dashboard", id: "dash-1" })
        )
      ).resolves.toBe(false);
      expect(checkPermissionBatch.mock.calls[0][0][2]).toMatchObject({
        permission: "mcp_reach",
        resource: { objectId: "workspace-1", objectType: "workspace" },
      });
    });

    test("decides dashboard.manage_access on the workspace's administer arm, never for an API key", async () => {
      await expect(
        checkSpicedbPermissionAtScope(
          { type: "user", id: "owner-1" },
          "dashboard.manage_access",
          { type: "dashboard", id: "dash-1" },
          scope({ type: "dashboard", id: "dash-1" })
        )
      ).resolves.toBe(true);
      expect(checkPermission).toHaveBeenCalledWith({
        permission: "administer",
        resource: { objectId: "workspace-1", objectType: "workspace" },
        subject: { objectId: "owner-1", objectType: "user" },
      });

      checkPermission.mockClear();
      await expect(
        checkSpicedbPermissionAtScope(
          { type: "apiKey", id: "key-1" },
          "dashboard.manage_access",
          { type: "dashboard", id: "dash-1" },
          scope({ type: "dashboard", id: "dash-1" })
        )
      ).resolves.toBe(false);
      expect(checkPermission).not.toHaveBeenCalled();
    });
  });

  test("maps API-key actors and resources to api_key", async () => {
    await expect(
      spicedbEvaluator.can({ type: "apiKey", id: "actor-key" }, "apiKey.manage", {
        type: "apiKey",
        id: "resource-key",
      })
    ).resolves.toBe(true);

    expect(checkPermission).toHaveBeenCalledWith({
      permission: "manage",
      resource: { objectId: "resource-key", objectType: "api_key" },
      subject: { objectId: "actor-key", objectType: "api_key" },
    });
  });

  test.each([
    ["manager", "manage_access", true],
    ["owner", "write", true],
    ["disabled", null, false],
  ])("honors the user-management floor %s", async (minimumRole, expectedPermission, allowed) => {
    constantsMock.minimumRole = minimumRole;

    await expect(
      checkSpicedbPermissionAtScope(
        { type: "user", id: "user-1" },
        "organization.manage_access",
        { type: "organization", id: "org-1" },
        {
          actorValid: true,
          organizationId: "org-1",
          permissionResource: { type: "organization", id: "org-1" },
        }
      )
    ).resolves.toBe(allowed);

    if (expectedPermission) {
      expect(checkPermission).toHaveBeenCalledWith(
        expect.objectContaining({ permission: expectedPermission })
      );
    } else {
      expect(getAuthzedClient).not.toHaveBeenCalled();
    }
  });

  test("does not apply the user-management floor to API keys", async () => {
    constantsMock.minimumRole = "disabled";

    await spicedbEvaluator.can({ type: "apiKey", id: "key-1" }, "organization.manage_access", {
      type: "organization",
      id: "org-1",
    });

    expect(checkPermission).toHaveBeenCalledWith(expect.objectContaining({ permission: "manage_access" }));
  });

  test("denies missing resources and invalid actors without constructing the client", async () => {
    vi.mocked(resolveAuthorizationScope).mockResolvedValueOnce(null);
    await expect(
      spicedbEvaluator.can({ type: "user", id: "user-1" }, "workspace.read", {
        type: "workspace",
        id: "missing",
      })
    ).resolves.toBe(false);

    await expect(
      checkSpicedbPermissionAtScope(
        { type: "user", id: "missing" },
        "workspace.read",
        { type: "workspace", id: "workspace-1" },
        {
          actorValid: false,
          organizationId: "org-1",
          permissionResource: { type: "workspace", id: "workspace-1" },
        }
      )
    ).resolves.toBe(false);

    expect(getAuthzedClient).not.toHaveBeenCalled();
  });

  test("returns the facade decision and propagates operational errors", async () => {
    checkPermission.mockResolvedValueOnce({ allowed: false });
    await expect(
      spicedbEvaluator.can({ type: "user", id: "user-1" }, "survey.read", { type: "survey", id: "survey-1" })
    ).resolves.toBe(false);

    const databaseFailure = new Error("database unavailable");
    vi.mocked(resolveAuthorizationScope).mockRejectedValueOnce(databaseFailure);
    await expect(
      spicedbEvaluator.can({ type: "user", id: "user-1" }, "survey.read", { type: "survey", id: "survey-1" })
    ).rejects.toBe(databaseFailure);
  });
});

describe("survey visibility decisions (ENG-3282)", () => {
  const user = { type: "user", id: "user-1" } as const;
  const apiKey = { type: "apiKey", id: "key-1" } as const;
  const surveyScope = {
    actorValid: true,
    organizationId: "org-1",
    permissionResource: { type: "survey", id: "survey-1" },
  } as const;
  const pendingScope = (ownerId: string | null) =>
    ({
      actorValid: true,
      organizationId: "org-1",
      permissionResource: { type: "workspace", id: "workspace-1" },
      policy: { kind: "pendingPrivate", neverAcknowledged: false, ownerId, surveyId: "survey-1" },
    }) as const;

  const checked = () => checkPermission.mock.calls.map(([check]) => check);

  test("decides a settled survey on its own node with the survey permission itself", async () => {
    await checkSpicedbPermissionAtScope(
      user,
      "survey.change_visibility",
      { type: "survey", id: "survey-1" },
      surveyScope
    );
    await checkSpicedbPermissionAtScope(
      user,
      "survey.delete",
      { type: "survey", id: "survey-1" },
      surveyScope
    );

    expect(checked()).toEqual([
      expect.objectContaining({
        permission: "change_visibility",
        resource: { objectId: "survey-1", objectType: "survey" },
      }),
      expect.objectContaining({
        permission: "delete_v2",
        resource: { objectId: "survey-1", objectType: "survey" },
      }),
    ]);
  });

  test.each([
    ["response.read", "response_read_v2"],
    ["response.write", "write_v2"],
    ["response.manage", "manage_v2"],
    ["response.export", "response_export_v2"],
  ] as const)("maps %s on the survey node to survey#%s", async (action, permission) => {
    await checkSpicedbPermissionAtScope(user, action, { type: "response", id: "response-1" }, surveyScope);

    expect(checked()).toEqual([
      expect.objectContaining({ permission, resource: { objectId: "survey-1", objectType: "survey" } }),
    ]);
  });

  test("a pending survey lets its owner through along their own workspace ladder", async () => {
    await checkSpicedbPermissionAtScope(
      user,
      "survey.write",
      { type: "survey", id: "survey-1" },
      pendingScope("user-1")
    );

    expect(checked()).toEqual([
      expect.objectContaining({
        permission: "write",
        resource: { objectId: "workspace-1", objectType: "workspace" },
      }),
    ]);
  });

  test("a pending survey admits anyone else only as an organization administrator", async () => {
    checkPermission.mockResolvedValueOnce({ allowed: false });

    await expect(
      checkSpicedbPermissionAtScope(
        user,
        "survey.read",
        { type: "survey", id: "survey-1" },
        pendingScope("owner-2")
      )
    ).resolves.toBe(false);
    expect(checked()).toEqual([
      expect.objectContaining({
        permission: "administer",
        resource: { objectId: "workspace-1", objectType: "workspace" },
      }),
    ]);
  });

  test("a pending ownerless survey is for administrators only", async () => {
    await checkSpicedbPermissionAtScope(
      user,
      "response.read",
      { type: "response", id: "r-1" },
      pendingScope(null)
    );

    expect(checked()).toEqual([expect.objectContaining({ permission: "administer" })]);
  });

  test("a pending survey never admits an API key, without asking SpiceDB", async () => {
    await expect(
      checkSpicedbPermissionAtScope(
        apiKey,
        "survey.read",
        { type: "survey", id: "survey-1" },
        pendingScope(null)
      )
    ).resolves.toBe(false);
    expect(checkPermission).not.toHaveBeenCalled();
  });

  test("change_visibility on a pending survey is still decided on the survey node", async () => {
    await checkSpicedbPermissionAtScope(
      user,
      "survey.change_visibility",
      { type: "survey", id: "survey-1" },
      pendingScope("user-1")
    );

    expect(checked()).toEqual([
      expect.objectContaining({
        permission: "change_visibility",
        resource: { objectId: "survey-1", objectType: "survey" },
      }),
    ]);
  });

  test("still rejects an action that does not belong to the resource, pending or not", async () => {
    await expect(
      checkSpicedbPermissionAtScope(
        user,
        "workspace.read" as never,
        { type: "survey", id: "survey-1" } as never,
        pendingScope(null)
      )
    ).rejects.toThrow("Invalid authorization action/resource combination");
  });
});

describe("a permission the deployed AuthZed schema does not define yet (ADR-0025)", () => {
  // What the client throws when SpiceDB still holds the 6.1 schema, which has no `dashboard_read`.
  const failedPrecondition = (details: string) =>
    new AuthzedError({
      attempts: 1,
      cause: Object.assign(new Error(`9 FAILED_PRECONDITION: ${details}`), { code: 9, details }),
      code: AUTHZED_ERROR_CODES.FAILED_PRECONDITION,
      grpcStatus: 9,
      operation: "check_permission",
      retryable: false,
    });
  const missingDashboardRead = () =>
    failedPrecondition("relation/permission `dashboard_read` not found under definition `workspace`");
  const dashboardRead = () =>
    spicedbEvaluator.can({ type: "user", id: "viewer-1" }, "workspace.dashboard_read", {
      type: "workspace",
      id: "workspace-1",
    });

  test("denies `dashboard_read` and logs, so a viewer gets a 403 rather than a 5xx", async () => {
    checkPermission.mockRejectedValueOnce(missingDashboardRead());

    await expect(dashboardRead()).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ permission: "dashboard_read" }),
      expect.any(String)
    );
  });

  test("keeps any other failed precondition on `dashboard_read` an operational error", async () => {
    const error = failedPrecondition("some other precondition failed");
    checkPermission.mockRejectedValueOnce(error);

    await expect(dashboardRead()).rejects.toBe(error);
  });

  test("never turns a missing permission into a denial for a permission the release did not add", async () => {
    const error = failedPrecondition("relation/permission `read` not found under definition `workspace`");
    checkPermission.mockRejectedValueOnce(error);

    await expect(
      spicedbEvaluator.can({ type: "user", id: "user-1" }, "workspace.read", {
        type: "workspace",
        id: "workspace-1",
      })
    ).rejects.toBe(error);
  });
});
