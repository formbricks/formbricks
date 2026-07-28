import { cleanup } from "@testing-library/react";
import { returnValidationErrors } from "next-safe-action";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ZodIssue, z } from "zod";
import { AuthorizationError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import { getMembershipRole } from "@/lib/membership/hooks/actions";
import { getTeamRoleByTeamIdUserId, getWorkspacePermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { checkAuthorizationUpdated, formatErrors } from "./action-client-middleware";

vi.mock("@/lib/authorization", () => ({
  can: vi.fn(),
}));

vi.mock("@/lib/membership/hooks/actions", () => ({
  getMembershipRole: vi.fn(),
}));

vi.mock("@/modules/ee/teams/lib/roles", () => ({
  getWorkspacePermissionByUserId: vi.fn(),
  getTeamRoleByTeamIdUserId: vi.fn(),
}));

vi.mock("next-safe-action", () => ({
  returnValidationErrors: vi.fn(),
}));

describe("action-client-middleware", () => {
  const userId = "user-1";
  const organizationId = "org-1";
  const workspaceId = "workspace-1";
  const teamId = "team-1";

  beforeEach(() => {
    vi.mocked(can).mockResolvedValue(false);
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  describe("formatErrors", () => {
    test("formats simple path ZodIssue", () => {
      const issues = [
        {
          code: "custom",
          path: ["name"],
          message: "Name is required",
        },
      ] as ZodIssue[];

      expect(formatErrors(issues)).toEqual({
        name: {
          _errors: ["Name is required"],
        },
      });
    });

    test("formats nested and multiple ZodIssues", () => {
      const issues = [
        {
          code: "custom",
          path: ["user", "address", "street"],
          message: "Street is required",
        },
        {
          code: "custom",
          path: ["email"],
          message: "Invalid email",
        },
      ] as ZodIssue[];

      expect(formatErrors(issues)).toEqual({
        "user.address.street": {
          _errors: ["Street is required"],
        },
        email: {
          _errors: ["Invalid email"],
        },
      });
    });
  });

  describe("central compatibility shapes", () => {
    test.each([
      [["owner", "manager", "member", "billing"], "organization.read"],
      [["owner", "manager", "member"], "organization.read_access"],
      [["owner", "manager", "billing"], "organization.manage_billing"],
      [["owner", "manager"], "organization.manage"],
      [["owner"], "organization.write"],
    ] as const)("maps organization roles %j to %s", async (roles, expectedAction) => {
      vi.mocked(can)
        .mockResolvedValueOnce(true)
        .mockImplementation(async (_actor, action) => action === expectedAction);

      await expect(
        checkAuthorizationUpdated({
          userId,
          organizationId,
          access: [{ type: "organization", roles: [...roles] }],
        })
      ).resolves.toBe(true);

      expect(can).toHaveBeenCalledWith({ type: "user", id: userId }, "organization.read", {
        type: "organization",
        id: organizationId,
      });
      expect(can).toHaveBeenCalledWith({ type: "user", id: userId }, expectedAction, {
        type: "organization",
        id: organizationId,
      });
      expect(can).toHaveBeenCalledTimes(expectedAction === "organization.read" ? 1 : 2);
      expect(getMembershipRole).not.toHaveBeenCalled();
    });

    test.each([
      [undefined, "workspace.read"],
      ["read", "workspace.read"],
      ["readWrite", "workspace.write"],
      ["manage", "workspace.manage"],
    ] as const)("maps workspace permission %s to %s", async (minPermission, expectedAction) => {
      vi.mocked(can).mockImplementation(async (_actor, action) =>
        ["organization.read", expectedAction].includes(action)
      );

      await expect(
        checkAuthorizationUpdated({
          userId,
          organizationId,
          access: [
            { type: "organization", roles: ["owner", "manager"] },
            { type: "workspaceTeam", workspaceId, minPermission },
          ],
        })
      ).resolves.toBe(true);

      expect(can).toHaveBeenCalledWith({ type: "user", id: userId }, expectedAction, {
        type: "workspace",
        id: workspaceId,
      });
      expect(getWorkspacePermissionByUserId).not.toHaveBeenCalled();
    });

    test("maps an admin team alternative to team.manage", async () => {
      vi.mocked(can).mockImplementation(async (_actor, action) =>
        ["organization.read", "team.manage"].includes(action)
      );

      await expect(
        checkAuthorizationUpdated({
          userId,
          organizationId,
          access: [
            { type: "organization", roles: ["owner", "manager"] },
            { type: "team", teamId, minPermission: "admin" },
          ],
        })
      ).resolves.toBe(true);

      expect(can).toHaveBeenCalledWith({ type: "user", id: userId }, "team.manage", {
        type: "team",
        id: teamId,
      });
      expect(getTeamRoleByTeamIdUserId).not.toHaveBeenCalled();
    });

    test("preserves ordered OR evaluation across multiple workspace alternatives", async () => {
      const otherWorkspaceId = "workspace-2";
      vi.mocked(can).mockImplementation(async (_actor, action, resource) => {
        if (action === "organization.read") return true;
        return resource.id === otherWorkspaceId;
      });

      await expect(
        checkAuthorizationUpdated({
          userId,
          organizationId,
          access: [
            { type: "organization", roles: ["owner", "manager"] },
            { type: "workspaceTeam", workspaceId, minPermission: "readWrite" },
            { type: "workspaceTeam", workspaceId: otherWorkspaceId, minPermission: "readWrite" },
          ],
        })
      ).resolves.toBe(true);

      expect(can).toHaveBeenNthCalledWith(3, { type: "user", id: userId }, "workspace.write", {
        type: "workspace",
        id: workspaceId,
      });
      expect(can).toHaveBeenNthCalledWith(4, { type: "user", id: userId }, "workspace.write", {
        type: "workspace",
        id: otherWorkspaceId,
      });
    });

    test("rejects a non-member before evaluating access alternatives", async () => {
      vi.mocked(can).mockResolvedValue(false);

      await expect(
        checkAuthorizationUpdated({
          userId,
          organizationId,
          access: [{ type: "organization", roles: ["owner"] }],
        })
      ).rejects.toThrow(new AuthorizationError("Not authorized"));

      expect(can).toHaveBeenCalledTimes(1);
    });

    test("returns validation errors after membership and before the permission decision", async () => {
      const schema = z.object({ name: z.string() });
      vi.mocked(can).mockResolvedValue(true);
      vi.mocked(returnValidationErrors).mockReturnValue("validation-error" as unknown as never);

      const result = await checkAuthorizationUpdated({
        userId,
        organizationId,
        access: [
          {
            type: "organization",
            schema,
            data: { name: 123 } as never,
            roles: ["owner"],
          },
        ],
      });

      expect(result).toBe("validation-error");
      expect(returnValidationErrors).toHaveBeenCalledWith(expect.any(Object), {
        name: { _errors: ["Invalid input: expected string, received number"] },
      });
      expect(can).toHaveBeenCalledTimes(1);
    });

    test("throws the standard denial after every alternative denies", async () => {
      vi.mocked(can).mockImplementation(async (_actor, action) => action === "organization.read");

      await expect(
        checkAuthorizationUpdated({
          userId,
          organizationId,
          access: [
            { type: "organization", roles: ["owner", "manager"] },
            { type: "workspaceTeam", workspaceId, minPermission: "manage" },
            { type: "team", teamId, minPermission: "admin" },
          ],
        })
      ).rejects.toThrow(new AuthorizationError("Not authorized"));
    });

    test("preserves legacy WorkspaceTeam access when the central workspace decision denies", async () => {
      vi.mocked(can).mockImplementation(async (_actor, action) => action === "organization.read");
      vi.mocked(getMembershipRole).mockResolvedValue("billing");
      vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue("manage");

      await expect(
        checkAuthorizationUpdated({
          userId,
          organizationId,
          access: [
            { type: "organization", roles: ["owner", "manager"] },
            { type: "workspaceTeam", workspaceId, minPermission: "manage" },
          ],
        })
      ).resolves.toBe(true);

      expect(can).toHaveBeenCalledWith({ type: "user", id: userId }, "workspace.manage", {
        type: "workspace",
        id: workspaceId,
      });
      expect(getMembershipRole).toHaveBeenCalledWith(userId, organizationId);
      expect(getWorkspacePermissionByUserId).toHaveBeenCalledWith(userId, workspaceId);
    });

    test("propagates central evaluator failures", async () => {
      const failure = new Error("database unavailable");
      vi.mocked(can).mockRejectedValue(failure);

      await expect(
        checkAuthorizationUpdated({
          userId,
          organizationId,
          access: [{ type: "organization", roles: ["owner"] }],
        })
      ).rejects.toBe(failure);
    });
  });

  describe("legacy fallback", () => {
    test("preserves arbitrary organization role sets", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("member");

      await expect(
        checkAuthorizationUpdated({
          userId,
          organizationId,
          access: [{ type: "organization", roles: ["member"] }],
        })
      ).resolves.toBe(true);

      expect(can).not.toHaveBeenCalled();
    });

    test("preserves standalone workspace access", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("member");
      vi.mocked(getWorkspacePermissionByUserId).mockResolvedValue("readWrite");

      await expect(
        checkAuthorizationUpdated({
          userId,
          organizationId,
          access: [{ type: "workspaceTeam", workspaceId, minPermission: "read" }],
        })
      ).resolves.toBe(true);

      expect(getWorkspacePermissionByUserId).toHaveBeenCalledWith(userId, workspaceId);
      expect(can).not.toHaveBeenCalled();
    });

    test("preserves contributor team checks", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("member");
      vi.mocked(getTeamRoleByTeamIdUserId).mockResolvedValue("admin");

      await expect(
        checkAuthorizationUpdated({
          userId,
          organizationId,
          access: [
            { type: "organization", roles: ["owner", "manager"] },
            { type: "team", teamId, minPermission: "contributor" },
          ],
        })
      ).resolves.toBe(true);

      expect(getTeamRoleByTeamIdUserId).toHaveBeenCalledWith(teamId, userId);
      expect(can).not.toHaveBeenCalled();
    });

    test("preserves fallback schema validation", async () => {
      const schema = z.object({ name: z.string() });
      vi.mocked(getMembershipRole).mockResolvedValue("member");
      vi.mocked(returnValidationErrors).mockReturnValue("validation-error" as unknown as never);

      await expect(
        checkAuthorizationUpdated({
          userId,
          organizationId,
          access: [
            {
              type: "organization",
              schema,
              data: { name: 123 } as never,
              roles: ["member"],
            },
          ],
        })
      ).resolves.toBe("validation-error");

      expect(can).not.toHaveBeenCalled();
    });
  });
});
