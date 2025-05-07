import { getMembershipRole } from "@/lib/membership/hooks/actions";
import { getProjectPermissionByUserId, getTeamRoleByTeamIdUserId } from "@/modules/ee/teams/lib/roles";
import { cleanup } from "@testing-library/react";
import { returnValidationErrors } from "next-safe-action";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ZodIssue, z } from "zod";
import { AuthorizationError } from "@formbricks/types/errors";
import { checkAuthorizationUpdated, formatErrors } from "./action-client-middleware";

vi.mock("@/lib/membership/hooks/actions", () => ({
  getMembershipRole: vi.fn(),
}));

vi.mock("@/modules/ee/teams/lib/roles", () => ({
  getProjectPermissionByUserId: vi.fn(),
  getTeamRoleByTeamIdUserId: vi.fn(),
}));

vi.mock("next-safe-action", () => ({
  returnValidationErrors: vi.fn(),
}));

describe("action-client-middleware", () => {
  const userId = "user-1";
  const organizationId = "org-1";
  const projectId = "project-1";
  const teamId = "team-1";

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  describe("formatErrors", () => {
    // We need to access the private function for testing
    // Using any to access the function directly

    test("formats simple path ZodIssue", () => {
      const issues = [
        {
          code: "custom",
          path: ["name"],
          message: "Name is required",
        },
      ] as ZodIssue[];

      const result = formatErrors(issues);
      expect(result).toEqual({
        name: {
          _errors: ["Name is required"],
        },
      });
    });

    test("formats nested path ZodIssue", () => {
      const issues = [
        {
          code: "custom",
          path: ["user", "address", "street"],
          message: "Street is required",
        },
      ] as ZodIssue[];

      const result = formatErrors(issues);
      expect(result).toEqual({
        "user.address.street": {
          _errors: ["Street is required"],
        },
      });
    });

    test("formats multiple ZodIssues", () => {
      const issues = [
        {
          code: "custom",
          path: ["name"],
          message: "Name is required",
        },
        {
          code: "custom",
          path: ["email"],
          message: "Invalid email",
        },
      ] as ZodIssue[];

      const result = formatErrors(issues);
      expect(result).toEqual({
        name: {
          _errors: ["Name is required"],
        },
        email: {
          _errors: ["Invalid email"],
        },
      });
    });
  });

  describe("checkAuthorizationUpdated", () => {
    test("returns validation errors when schema validation fails", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("owner");

      const mockSchema = z.object({
        name: z.string(),
      });

      const mockData = { name: 123 }; // Type error to trigger validation failure

      vi.mocked(returnValidationErrors).mockReturnValue("validation-error" as unknown as never);

      const access = [
        {
          type: "organization" as const,
          schema: mockSchema,
          data: mockData as any,
          roles: ["owner" as const],
        },
      ];

      const result = await checkAuthorizationUpdated({
        userId,
        organizationId,
        access,
      });

      expect(returnValidationErrors).toHaveBeenCalledWith(expect.any(Object), expect.any(Object));
      expect(result).toBe("validation-error");
    });

    test("returns true when organization access matches role", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("owner");

      const access = [
        {
          type: "organization" as const,
          roles: ["owner" as const],
        },
      ];

      const result = await checkAuthorizationUpdated({ userId, organizationId, access });

      expect(result).toBe(true);
    });

    test("continues checking other access items when organization role doesn't match", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("member");

      const access = [
        {
          type: "organization" as const,
          roles: ["owner" as const],
        },
        {
          type: "projectTeam" as const,
          projectId,
          minPermission: "read" as const,
        },
      ];

      vi.mocked(getProjectPermissionByUserId).mockResolvedValue("readWrite");

      const result = await checkAuthorizationUpdated({ userId, organizationId, access });

      expect(result).toBe(true);
      expect(getProjectPermissionByUserId).toHaveBeenCalledWith(userId, projectId);
    });

    test("returns true when projectTeam access matches permission", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("member");

      const access = [
        {
          type: "projectTeam" as const,
          projectId,
          minPermission: "read" as const,
        },
      ];

      vi.mocked(getProjectPermissionByUserId).mockResolvedValue("readWrite");

      const result = await checkAuthorizationUpdated({ userId, organizationId, access });

      expect(result).toBe(true);
      expect(getProjectPermissionByUserId).toHaveBeenCalledWith(userId, projectId);
    });

    test("continues checking other access items when projectTeam permission is insufficient", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("member");

      const access = [
        {
          type: "projectTeam" as const,
          projectId,
          minPermission: "manage" as const,
        },
        {
          type: "team" as const,
          teamId,
          minPermission: "contributor" as const,
        },
      ];

      vi.mocked(getProjectPermissionByUserId).mockResolvedValue("read");
      vi.mocked(getTeamRoleByTeamIdUserId).mockResolvedValue("admin");

      const result = await checkAuthorizationUpdated({ userId, organizationId, access });

      expect(result).toBe(true);
      expect(getProjectPermissionByUserId).toHaveBeenCalledWith(userId, projectId);
      expect(getTeamRoleByTeamIdUserId).toHaveBeenCalledWith(teamId, userId);
    });

    test("returns true when team access matches role", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("member");

      const access = [
        {
          type: "team" as const,
          teamId,
          minPermission: "contributor" as const,
        },
      ];

      vi.mocked(getTeamRoleByTeamIdUserId).mockResolvedValue("admin");

      const result = await checkAuthorizationUpdated({ userId, organizationId, access });

      expect(result).toBe(true);
      expect(getTeamRoleByTeamIdUserId).toHaveBeenCalledWith(teamId, userId);
    });

    test("continues checking other access items when team role is insufficient", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("member");

      const access = [
        {
          type: "team" as const,
          teamId,
          minPermission: "admin" as const,
        },
        {
          type: "organization" as const,
          roles: ["member" as const],
        },
      ];

      vi.mocked(getTeamRoleByTeamIdUserId).mockResolvedValue("contributor");

      const result = await checkAuthorizationUpdated({ userId, organizationId, access });

      expect(result).toBe(true);
      expect(getTeamRoleByTeamIdUserId).toHaveBeenCalledWith(teamId, userId);
    });

    test("throws AuthorizationError when no access matches", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("member");

      const access = [
        {
          type: "organization" as const,
          roles: ["owner" as const],
        },
        {
          type: "projectTeam" as const,
          projectId,
          minPermission: "manage" as const,
        },
        {
          type: "team" as const,
          teamId,
          minPermission: "admin" as const,
        },
      ];

      vi.mocked(getProjectPermissionByUserId).mockResolvedValue("read");
      vi.mocked(getTeamRoleByTeamIdUserId).mockResolvedValue("contributor");

      await expect(checkAuthorizationUpdated({ userId, organizationId, access })).rejects.toThrow(
        AuthorizationError
      );
      await expect(checkAuthorizationUpdated({ userId, organizationId, access })).rejects.toThrow(
        "Not authorized"
      );
    });

    test("continues to check when projectPermission is null", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("member");

      const access = [
        {
          type: "projectTeam" as const,
          projectId,
          minPermission: "read" as const,
        },
        {
          type: "organization" as const,
          roles: ["member" as const],
        },
      ];

      vi.mocked(getProjectPermissionByUserId).mockResolvedValue(null);

      const result = await checkAuthorizationUpdated({ userId, organizationId, access });

      expect(result).toBe(true);
    });

    test("continues to check when teamRole is null", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("member");

      const access = [
        {
          type: "team" as const,
          teamId,
          minPermission: "contributor" as const,
        },
        {
          type: "organization" as const,
          roles: ["member" as const],
        },
      ];

      vi.mocked(getTeamRoleByTeamIdUserId).mockResolvedValue(null);

      const result = await checkAuthorizationUpdated({ userId, organizationId, access });

      expect(result).toBe(true);
    });

    test("returns true when schema validation passes", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("owner");

      const mockSchema = z.object({
        name: z.string(),
      });

      const mockData = { name: "test" };

      const access = [
        {
          type: "organization" as const,
          schema: mockSchema,
          data: mockData,
          roles: ["owner" as const],
        },
      ];

      const result = await checkAuthorizationUpdated({ userId, organizationId, access });

      expect(result).toBe(true);
    });

    test("handles projectTeam access without minPermission specified", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("member");

      const access = [
        {
          type: "projectTeam" as const,
          projectId,
        },
      ];

      vi.mocked(getProjectPermissionByUserId).mockResolvedValue("read");

      const result = await checkAuthorizationUpdated({ userId, organizationId, access });

      expect(result).toBe(true);
    });

    test("handles team access without minPermission specified", async () => {
      vi.mocked(getMembershipRole).mockResolvedValue("member");

      const access = [
        {
          type: "team" as const,
          teamId,
        },
      ];

      vi.mocked(getTeamRoleByTeamIdUserId).mockResolvedValue("contributor");

      const result = await checkAuthorizationUpdated({ userId, organizationId, access });

      expect(result).toBe(true);
    });
  });
});
