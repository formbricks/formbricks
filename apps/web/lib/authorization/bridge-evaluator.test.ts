import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getAuthzedClient } from "@/lib/authzed/client";
import { assertAuthzedProjectionFreshness } from "@/lib/authzed/outbox-freshness";
import { bridgeEvaluator } from "./bridge-evaluator";
import {
  AUTHORIZATION_PERMISSION_MAP,
  type TAuthorizationAction,
  type TAuthorizationActor,
  type TAuthorizationResource,
} from "./contract";
import { getApiKeyAuthById } from "./resolvers";
import { resolveAuthorizationScope } from "./source-scope";

const config = vi.hoisted(() => ({ minimumRole: "manager" as "owner" | "manager" | "disabled" }));
vi.mock("@formbricks/database", () => ({
  prisma: {
    membership: { findUnique: vi.fn() },
    teamUser: { findUnique: vi.fn() },
    feedbackDirectoryWorkspace: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));
vi.mock("@/lib/constants", () => ({
  get USER_MANAGEMENT_MINIMUM_ROLE() {
    return config.minimumRole;
  },
}));
vi.mock("./resolvers", () => ({ getApiKeyAuthById: vi.fn() }));
vi.mock("./source-scope", () => ({ resolveAuthorizationScope: vi.fn() }));
vi.mock("@/lib/authzed/client", () => ({ getAuthzedClient: vi.fn() }));
vi.mock("@/lib/authzed/outbox-freshness", () => ({ assertAuthzedProjectionFreshness: vi.fn() }));

const user = { type: "user", id: "user" } as const;
const key = { type: "apiKey", id: "key" } as const;
const actions = Object.entries(AUTHORIZATION_PERMISSION_MAP).flatMap(([type, permissions]) =>
  permissions.map((permission) => `${type}.${permission}` as TAuthorizationAction)
);
const resourceFor = (action: TAuthorizationAction): TAuthorizationResource => {
  const type = action.split(".")[0] as TAuthorizationResource["type"];
  return type === "feedbackDirectoryAssignment"
    ? { type, feedbackDirectoryId: "directory", workspaceId: "workspace" }
    : { type, id: type };
};
const check = (actor: TAuthorizationActor, action: TAuthorizationAction) =>
  bridgeEvaluator.can(actor, action, resourceFor(action));

beforeEach(() => {
  config.minimumRole = "manager";
  vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "owner" } as never);
  vi.mocked(prisma.teamUser.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: "workspace" }]);
  vi.mocked(prisma.feedbackDirectoryWorkspace.findMany).mockResolvedValue([
    { workspaceId: "workspace" },
  ] as never);
  vi.mocked(getApiKeyAuthById).mockResolvedValue({
    type: "apiKey",
    apiKeyId: "key",
    organizationId: "organization",
    organizationAccess: { accessControl: { read: true, write: true } },
    workspacePermissions: [{ workspaceId: "workspace", workspaceName: "Workspace", permission: "manage" }],
  });
  vi.mocked(resolveAuthorizationScope).mockResolvedValue({
    actorValid: true,
    organizationId: "organization",
    permissionResource: { type: "workspace", id: "workspace" },
  });
  vi.mocked(getAuthzedClient).mockImplementation(() => {
    throw new Error("SDK unavailable");
  });
  vi.mocked(assertAuthzedProjectionFreshness).mockRejectedValue(new Error("projection stale"));
});

describe("temporary PostgreSQL bridge evaluator", () => {
  test("covers the unchanged 35-action contract", () => expect(actions).toHaveLength(35));
  test.each(actions)("owner: %s stays allowed without SpiceDB", async (action) => {
    await expect(check(user, action)).resolves.toBe(true);
    expect(getAuthzedClient).not.toHaveBeenCalled();
    expect(assertAuthzedProjectionFreshness).not.toHaveBeenCalled();
  });
  test.each(actions)("API key: %s preserves user-only actions", async (action) => {
    const userOnly = [
      "apiKey.read",
      "apiKey.manage",
      "organization.write",
      "organization.manage",
      "organization.manage_billing",
      "organization.manage_api_keys",
    ];
    await expect(check(key, action)).resolves.toBe(!userOnly.includes(action));
    expect(getAuthzedClient).not.toHaveBeenCalled();
  });
  test.each([
    [
      "owner",
      ["read", "write", "manage", "manage_billing", "read_access", "manage_access", "manage_api_keys"],
    ],
    ["manager", ["read", "manage", "manage_billing", "read_access", "manage_access", "manage_api_keys"]],
    ["member", ["read", "read_access"]],
    ["billing", ["read", "manage_billing"]],
    [null, []],
  ] as const)("organization role %s", async (role, allowed) => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue(role === null ? null : ({ role } as never));
    for (const permission of AUTHORIZATION_PERMISSION_MAP.organization) {
      await expect(check(user, `organization.${permission}`)).resolves.toBe(
        (allowed as readonly string[]).includes(permission)
      );
    }
  });
  test.each(["owner", "manager", "disabled"] as const)(
    "user-management floor %s does not redefine team/API-key management",
    async (floor) => {
      config.minimumRole = floor;
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "manager" } as never);
      await expect(check(user, "organization.manage_access")).resolves.toBe(floor === "manager");
      await expect(check(user, "team.manage")).resolves.toBe(true);
      await expect(check(user, "team.delete")).resolves.toBe(true);
      await expect(check(user, "apiKey.manage")).resolves.toBe(true);
      await expect(check(key, "organization.manage_access")).resolves.toBe(true);
    }
  );
  test.each(["admin", "contributor"] as const)(
    "team %s can only manage when admin, never delete",
    async (role) => {
      vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "member" } as never);
      vi.mocked(prisma.teamUser.findUnique).mockResolvedValue({ role } as never);
      await expect(check(user, "team.read")).resolves.toBe(true);
      await expect(check(user, "team.manage")).resolves.toBe(role === "admin");
      await expect(check(user, "team.delete")).resolves.toBe(false);
    }
  );
  test("billing cannot read a team through stale contributor membership", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "billing" } as never);
    vi.mocked(prisma.teamUser.findUnique).mockResolvedValue({ role: "contributor" } as never);
    await expect(check(user, "team.read")).resolves.toBe(false);
  });
  test.each(actions)(
    "invalid actor or missing/archived/foreign resource denies %s before rule evaluation",
    async (action) => {
      vi.mocked(resolveAuthorizationScope)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          actorValid: false,
          organizationId: "organization",
          permissionResource: { type: "workspace", id: "workspace" },
        });
      await expect(check(user, action)).resolves.toBe(false);
      await expect(check(key, action)).resolves.toBe(false);
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(getApiKeyAuthById).not.toHaveBeenCalled();
    }
  );
  test("exact assignment cannot borrow permission from a different workspace", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "member" } as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: "other-workspace" }]);
    await expect(check(user, "feedbackDirectoryAssignment.read")).resolves.toBe(false);
    vi.mocked(prisma.feedbackDirectoryWorkspace.findMany).mockResolvedValue([
      { workspaceId: "other-workspace" },
    ] as never);
    await expect(check(user, "feedbackDirectory.read")).resolves.toBe(true);
    expect(prisma.feedbackDirectoryWorkspace.findMany).toHaveBeenCalledWith({
      where: { feedbackDirectoryId: "feedbackDirectory", workspace: { organizationId: "organization" } },
      select: { workspaceId: true },
    });
  });
  test("unassigned datasets remain available to organization administrators only", async () => {
    vi.mocked(prisma.feedbackDirectoryWorkspace.findMany).mockResolvedValue([]);
    await expect(check(user, "feedbackDirectory.manage")).resolves.toBe(true);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "member" } as never);
    await expect(check(user, "feedbackDirectory.read")).resolves.toBe(false);
    await expect(check(key, "feedbackDirectory.read")).resolves.toBe(false);
  });
  test("resolver and database failures propagate, not false", async () => {
    const failure = new Error("sensitive database error");
    vi.mocked(resolveAuthorizationScope).mockRejectedValueOnce(failure);
    await expect(check(user, "workspace.read")).rejects.toBe(failure);
    vi.mocked(prisma.membership.findUnique).mockRejectedValueOnce(failure);
    await expect(check(user, "organization.read")).rejects.toBe(failure);
  });
  test("rejects unknown actors and invalid action/resource pairs without including input values", async () => {
    await expect(check({ type: "system", id: "secret" } as never, "workspace.read")).rejects.toThrow(
      "Unsupported authorization actor"
    );
    await expect(
      bridgeEvaluator.can(user, "workspace.read", { type: "survey", id: "secret" } as never)
    ).rejects.toThrow("Invalid authorization action/resource combination");
    await expect(check(user, "workspace.read.secret" as never)).rejects.toThrow(
      "Invalid authorization action/resource combination"
    );
    expect(resolveAuthorizationScope).not.toHaveBeenCalled();
  });
});
