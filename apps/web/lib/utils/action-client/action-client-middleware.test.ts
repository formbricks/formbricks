import { cleanup } from "@testing-library/react";
import { returnValidationErrors } from "next-safe-action";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ZodIssue, z } from "zod";
import { logger } from "@formbricks/logger";
import { AuthorizationError } from "@formbricks/types/errors";
import { can } from "@/lib/authorization";
import { checkAuthorizationUpdated, formatErrors } from "./action-client-middleware";

vi.mock("@/lib/authorization", () => ({
  can: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("next-safe-action", () => ({
  returnValidationErrors: vi.fn(),
}));

describe("action-client-middleware", () => {
  const userId = "user-1";
  const organizationId = "org-1";
  const workspaceId = "workspace-1";

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
          ],
        })
      ).rejects.toThrow(new AuthorizationError("Not authorized"));
    });

    test("denies an empty requirement list instead of treating it as no requirement", async () => {
      vi.mocked(can).mockResolvedValue(true);

      await expect(checkAuthorizationUpdated({ userId, organizationId, access: [] })).rejects.toThrow(
        new AuthorizationError("Not authorized")
      );
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

  // ENG-1737 removed the parallel legacy evaluator these shapes used to reach. What replaces
  // it is a refusal, so the cases below pin the failure mode rather than the old behavior.
  describe("shapes with no central meaning", () => {
    test("refuses an unmapped organization role set, and says so", async () => {
      vi.mocked(can).mockResolvedValue(true);

      await expect(
        checkAuthorizationUpdated({
          userId,
          organizationId,
          access: [{ type: "organization", roles: ["member"] }],
        })
      ).rejects.toThrow(new AuthorizationError("Not authorized"));

      // The membership gate is the only decision that ran; the role set itself never mapped.
      expect(can).toHaveBeenCalledTimes(1);
      expect(logger.error).toHaveBeenCalledWith(
        { roleSet: "member" },
        "Unmapped organization role set in action-client authorization"
      );
    });

    test("evaluates a workspace-only requirement centrally, with no organization item", async () => {
      vi.mocked(can).mockImplementation(async (_actor, action) =>
        ["organization.read", "workspace.read"].includes(action)
      );

      await expect(
        checkAuthorizationUpdated({
          userId,
          organizationId,
          access: [{ type: "workspaceTeam", workspaceId, minPermission: "read" }],
        })
      ).resolves.toBe(true);

      expect(can).toHaveBeenCalledWith({ type: "user", id: userId }, "workspace.read", {
        type: "workspace",
        id: workspaceId,
      });
      expect(logger.error).not.toHaveBeenCalled();
    });

    test("still returns schema validation errors ahead of the role mapping", async () => {
      const schema = z.object({ name: z.string() });
      vi.mocked(can).mockResolvedValue(true);
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

      expect(logger.error).not.toHaveBeenCalled();
    });
  });
});
