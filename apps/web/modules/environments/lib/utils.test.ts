// utils.test.ts
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { getEnvironment } from "@/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { getUser } from "@/lib/user/service";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
// Pull in the mocked implementations to configure them in tests
import { getTranslate } from "@/tolgee/server";
import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { AuthorizationError } from "@formbricks/types/errors";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import { TUser } from "@formbricks/types/user";
import { environmentIdLayoutChecks, getEnvironmentAuth } from "./utils";

// Mock all external dependencies
vi.mock("@/tolgee/server", () => ({
  getTranslate: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

vi.mock("@/modules/ee/teams/lib/roles", () => ({
  getProjectPermissionByUserId: vi.fn(),
}));

vi.mock("@/modules/ee/teams/utils/teams", () => ({
  getTeamPermissionFlags: vi.fn(),
}));

vi.mock("@/lib/environment/auth", () => ({
  hasUserEnvironmentAccess: vi.fn(),
}));

vi.mock("@/lib/environment/service", () => ({
  getEnvironment: vi.fn(),
}));

vi.mock("@/lib/membership/service", () => ({
  getMembershipByUserIdOrganizationId: vi.fn(),
}));

vi.mock("@/lib/membership/utils", () => ({
  getAccessFlags: vi.fn(),
}));

vi.mock("@/lib/organization/service", () => ({
  getOrganizationByEnvironmentId: vi.fn(),
}));

vi.mock("@/lib/project/service", () => ({
  getProjectByEnvironmentId: vi.fn(),
}));

vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@formbricks/types/errors", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
}));

describe("utils.ts", () => {
  beforeEach(() => {
    // Provide default mocks for successful scenario
    vi.mocked(getTranslate).mockResolvedValue(((key: string) => key) as any); // Mock translation function
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user123" } });
    vi.mocked(getEnvironment).mockResolvedValue({ id: "env123" } as TEnvironment);
    vi.mocked(getProjectByEnvironmentId).mockResolvedValue({ id: "proj123" } as TProject);
    vi.mocked(getOrganizationByEnvironmentId).mockResolvedValue({ id: "org123" } as TOrganization);
    vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValue({
      role: "member",
    } as unknown as TMembership);
    vi.mocked(getAccessFlags).mockReturnValue({
      isMember: true,
      isOwner: false,
      isManager: false,
      isBilling: false,
    });
    vi.mocked(getProjectPermissionByUserId).mockResolvedValue("read");
    vi.mocked(getTeamPermissionFlags).mockReturnValue({
      hasReadAccess: true,
      hasReadWriteAccess: true,
      hasManageAccess: true,
    });
    vi.mocked(hasUserEnvironmentAccess).mockResolvedValue(true);
    vi.mocked(getUser).mockResolvedValue({ id: "user123" } as TUser);
  });

  describe("getEnvironmentAuth", () => {
    test("returns environment data on success", async () => {
      const result = await getEnvironmentAuth("env123");
      expect(result.environment.id).toBe("env123");
      expect(result.project.id).toBe("proj123");
      expect(result.organization.id).toBe("org123");
      expect(result.session.user.id).toBe("user123");
      expect(result.isReadOnly).toBe(true); // from mocks (isMember = true & hasReadAccess = true)
    });

    test("throws error if project not found", async () => {
      vi.mocked(getProjectByEnvironmentId).mockResolvedValueOnce(null);
      await expect(getEnvironmentAuth("env123")).rejects.toThrow("common.project_not_found");
    });

    test("throws error if environment not found", async () => {
      vi.mocked(getEnvironment).mockResolvedValueOnce(null);
      await expect(getEnvironmentAuth("env123")).rejects.toThrow("common.environment_not_found");
    });

    test("throws error if session not found", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);
      await expect(getEnvironmentAuth("env123")).rejects.toThrow("common.session_not_found");
    });

    test("throws error if organization not found", async () => {
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce(null);
      await expect(getEnvironmentAuth("env123")).rejects.toThrow("common.organization_not_found");
    });

    test("throws error if membership not found", async () => {
      vi.mocked(getMembershipByUserIdOrganizationId).mockResolvedValueOnce(null);
      await expect(getEnvironmentAuth("env123")).rejects.toThrow("common.membership_not_found");
    });
  });

  describe("environmentIdLayoutChecks", () => {
    test("returns t, session, user, and organization on success", async () => {
      const result = await environmentIdLayoutChecks("env123");
      expect(result.t).toBeInstanceOf(Function);
      expect(result.session?.user.id).toBe("user123");
      expect(result.user?.id).toBe("user123");
      expect(result.organization?.id).toBe("org123");
    });

    test("returns session=null and user=null if session does not have user", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({});
      const result = await environmentIdLayoutChecks("env123");
      expect(result.session).toBe(null);
      expect(result.user).toBe(null);
      expect(result.organization).toBe(null);
    });

    test("returns user=null if user is not found", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "user123" } });
      vi.mocked(getUser).mockResolvedValueOnce(null);
      const result = await environmentIdLayoutChecks("env123");
      expect(result.session?.user.id).toBe("user123");
      expect(result.user).toBe(null);
      expect(result.organization).toBe(null);
    });

    test("throws AuthorizationError if user has no environment access", async () => {
      vi.mocked(hasUserEnvironmentAccess).mockResolvedValueOnce(false);
      await expect(environmentIdLayoutChecks("env123")).rejects.toThrow(AuthorizationError);
    });

    test("throws error if organization not found", async () => {
      vi.mocked(getOrganizationByEnvironmentId).mockResolvedValueOnce(null);
      await expect(environmentIdLayoutChecks("env123")).rejects.toThrow("common.organization_not_found");
    });
  });
});
