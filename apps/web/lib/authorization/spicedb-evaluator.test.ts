import { beforeEach, describe, expect, test, vi } from "vitest";
import { getAuthzedClient } from "@/lib/authzed/client";
import { AUTHORIZATION_PERMISSION_MAP, type TAuthorizationAction } from "./contract";
import { resolveAuthorizationScope } from "./source-scope";
import { checkSpicedbPermissionAtScope, spicedbEvaluator } from "./spicedb-evaluator";

const constantsMock = vi.hoisted(() => ({ minimumRole: "manager" }));

vi.mock("@/lib/constants", () => ({
  get USER_MANAGEMENT_MINIMUM_ROLE() {
    return constantsMock.minimumRole;
  },
}));
vi.mock("@/lib/authzed/client", () => ({ getAuthzedClient: vi.fn() }));
vi.mock("./source-scope", () => ({ resolveAuthorizationScope: vi.fn() }));

const checkPermission = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  constantsMock.minimumRole = "manager";
  vi.mocked(getAuthzedClient).mockReturnValue({ checkPermission } as never);
  vi.mocked(resolveAuthorizationScope).mockImplementation(async (_actor, resource) => ({
    actorValid: true,
    organizationId: "org-1",
    permissionResource:
      resource.type === "survey" || resource.type === "dashboard" || resource.type === "response"
        ? { type: "workspace", id: "workspace-1" }
        : resource,
  }));
  checkPermission.mockResolvedValue({ allowed: true });
});

describe("spicedbEvaluator", () => {
  test("maps every current action to its resource and SpiceDB permission", async () => {
    for (const [resourceType, permissions] of Object.entries(AUTHORIZATION_PERMISSION_MAP)) {
      for (const permission of permissions) {
        checkPermission.mockClear();
        const action = `${resourceType}.${permission}` as TAuthorizationAction;

        await expect(
          spicedbEvaluator.can({ type: "user", id: "user-1" }, action, {
            type: resourceType,
            id: "resource-1",
          } as never)
        ).resolves.toBe(true);

        const derivedPermission = {
          "dashboard.read": "read",
          "dashboard.write": "write",
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
                objectId: "resource-1",
                objectType:
                  resourceType === "apiKey"
                    ? "api_key"
                    : resourceType === "feedbackDirectory"
                      ? "feedback_directory"
                      : resourceType === "feedbackDirectoryAssignment"
                        ? "feedback_directory_assignment"
                        : resourceType,
              },
          subject: { objectId: "user-1", objectType: "user" },
        });
      }
    }
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
