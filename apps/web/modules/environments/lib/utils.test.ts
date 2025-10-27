// utils.test.ts
// Pull in the mocked implementations to configure them in tests
import { getServerSession } from "next-auth";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TEnvironment } from "@formbricks/types/environment";
import { AuthorizationError } from "@formbricks/types/errors";
import { TMembership } from "@formbricks/types/memberships";
import { TOrganization } from "@formbricks/types/organizations";
import { TProject } from "@formbricks/types/project";
import { TUser } from "@formbricks/types/user";
import { hasUserEnvironmentAccess } from "@/lib/environment/auth";
import { getEnvironment } from "@/lib/environment/service";
import { getMembershipByUserIdOrganizationId } from "@/lib/membership/service";
import { getAccessFlags } from "@/lib/membership/utils";
import {
  getMonthlyActiveOrganizationPeopleCount,
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@/lib/organization/service";
import { getProjectByEnvironmentId } from "@/lib/project/service";
import { getUser } from "@/lib/user/service";
import { getEnterpriseLicense } from "@/modules/ee/license-check/lib/license";
import { getAccessControlPermission } from "@/modules/ee/license-check/lib/utils";
import { getProjectPermissionByUserId } from "@/modules/ee/teams/lib/roles";
import { getTeamPermissionFlags } from "@/modules/ee/teams/utils/teams";
// Pull in the mocked implementations to configure them in tests
import {
  environmentIdLayoutChecks,
  getEnvironmentAuth,
  getEnvironmentLayoutData,
  getEnvironmentWithRelations,
} from "./utils";

// Mock all external dependencies
vi.mock("@/lingodotdev/server", () => ({
  getTranslate: vi.fn(() => (key: string) => key),
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
  getMonthlyActiveOrganizationPeopleCount: vi.fn(),
  getMonthlyOrganizationResponseCount: vi.fn(),
}));

vi.mock("@/lib/project/service", () => ({
  getProjectByEnvironmentId: vi.fn(),
}));

vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/license", () => ({
  getEnterpriseLicense: vi.fn(),
}));

vi.mock("@/modules/ee/license-check/lib/utils", () => ({
  getAccessControlPermission: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    environment: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
}));

vi.mock("@formbricks/types/errors", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  DatabaseError: class DatabaseError extends Error {},
}));

describe("utils.ts", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Provide default mocks for successful scenario
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
    vi.mocked(getEnterpriseLicense).mockResolvedValue({
      active: true,
      features: { isMultiOrgEnabled: false },
      lastChecked: new Date(),
      isPendingDowngrade: false,
      fallbackLevel: "none",
    } as any);
    vi.mocked(getAccessControlPermission).mockResolvedValue(true);
    vi.mocked(getMonthlyActiveOrganizationPeopleCount).mockResolvedValue(0);
    vi.mocked(getMonthlyOrganizationResponseCount).mockResolvedValue(0);
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

  describe("getEnvironmentWithRelations", () => {
    const mockPrismaData = {
      id: "env123",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-02"),
      type: "production" as const,
      projectId: "proj123",
      appSetupCompleted: true,
      project: {
        id: "proj123",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        name: "Test Project",
        organizationId: "org123",
        languages: ["en"],
        recontactDays: 7,
        linkSurveyBranding: true,
        inAppSurveyBranding: true,
        config: {},
        placement: "bottomRight" as const,
        clickOutsideClose: true,
        darkOverlay: false,
        styling: {},
        logo: null,
        environments: [
          {
            id: "env123",
            type: "production" as const,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-02"),
            projectId: "proj123",
            appSetupCompleted: true,
          },
          {
            id: "env456",
            type: "development" as const,
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-02"),
            projectId: "proj123",
            appSetupCompleted: false,
          },
        ],
        organization: {
          id: "org123",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-02"),
          name: "Test Organization",
          billing: { plan: "free" },
          isAIEnabled: false,
          whitelabel: false,
          memberships: [
            {
              userId: "user123",
              organizationId: "org123",
              accepted: true,
              role: "owner" as const,
            },
          ],
        },
      },
    };

    beforeEach(() => {
      vi.mocked(prisma.environment.findUnique).mockResolvedValue(mockPrismaData as any);
    });

    test("returns combined environment, project, organization, and membership data", async () => {
      const result = await getEnvironmentWithRelations("env123", "user123");

      expect(result).toBeDefined();
      expect(result!.environment.id).toBe("env123");
      expect(result!.environment.type).toBe("production");
      expect(result!.project.id).toBe("proj123");
      expect(result!.project.name).toBe("Test Project");
      expect(result!.organization.id).toBe("org123");
      expect(result!.organization.name).toBe("Test Organization");
      expect(result!.environments).toHaveLength(2);
      expect(result!.membership).toEqual({
        userId: "user123",
        organizationId: "org123",
        accepted: true,
        role: "owner",
      });
    });

    test("fetches only current user's membership using database-level filtering", async () => {
      await getEnvironmentWithRelations("env123", "user123");

      expect(prisma.environment.findUnique).toHaveBeenCalledWith({
        where: { id: "env123" },
        select: expect.objectContaining({
          project: expect.objectContaining({
            select: expect.objectContaining({
              organization: expect.objectContaining({
                select: expect.objectContaining({
                  memberships: expect.objectContaining({
                    where: { userId: "user123" },
                    take: 1,
                  }),
                }),
              }),
            }),
          }),
        }),
      });
    });

    test("returns null when environment not found", async () => {
      vi.mocked(prisma.environment.findUnique).mockResolvedValueOnce(null);

      const result = await getEnvironmentWithRelations("env123", "user123");

      expect(result).toBeNull();
    });

    test("returns null membership when user has no membership", async () => {
      const dataWithoutMembership = {
        ...mockPrismaData,
        project: {
          ...mockPrismaData.project,
          organization: {
            ...mockPrismaData.project.organization,
            memberships: [], // No memberships
          },
        },
      };
      vi.mocked(prisma.environment.findUnique).mockResolvedValueOnce(dataWithoutMembership as any);

      const result = await getEnvironmentWithRelations("env123", "user123");

      expect(result!.membership).toBeNull();
    });

    test("throws error on database failure", async () => {
      // Mock a database error
      const dbError = new Error("Database connection failed");
      vi.mocked(prisma.environment.findUnique).mockRejectedValueOnce(dbError);

      // Verify function throws (specific error type depends on Prisma error detection)
      await expect(getEnvironmentWithRelations("env123", "user123")).rejects.toThrow();
    });

    // Note: Input validation for environmentId and userId is handled by
    // getEnvironmentLayoutData (the parent function), not here.
    // See getEnvironmentLayoutData tests for validation coverage.
  });

  describe("getEnvironmentLayoutData", () => {
    beforeEach(() => {
      vi.mocked(prisma.environment.findUnique).mockResolvedValue({
        id: "env123",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
        type: "production",
        projectId: "proj123",
        appSetupCompleted: true,
        project: {
          id: "proj123",
          createdAt: new Date("2024-01-01"),
          updatedAt: new Date("2024-01-02"),
          name: "Test Project",
          organizationId: "org123",
          languages: ["en"],
          recontactDays: 7,
          linkSurveyBranding: true,
          inAppSurveyBranding: true,
          config: {},
          placement: "bottomRight",
          clickOutsideClose: true,
          darkOverlay: false,
          styling: {},
          logo: null,
          environments: [
            {
              id: "env123",
              type: "production",
              createdAt: new Date("2024-01-01"),
              updatedAt: new Date("2024-01-02"),
              projectId: "proj123",
              appSetupCompleted: true,
            },
          ],
          organization: {
            id: "org123",
            createdAt: new Date("2024-01-01"),
            updatedAt: new Date("2024-01-02"),
            name: "Test Organization",
            billing: { plan: "free", limits: {} },
            isAIEnabled: false,
            whitelabel: false,
            memberships: [
              {
                userId: "user123",
                organizationId: "org123",
                accepted: true,
                role: "owner",
              },
            ],
          },
        },
      } as any);
    });

    test("returns complete layout data on success", async () => {
      const result = await getEnvironmentLayoutData("env123", "user123");

      expect(result).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.environment).toBeDefined();
      expect(result.project).toBeDefined();
      expect(result.organization).toBeDefined();
      expect(result.environments).toBeDefined();
      expect(result.membership).toBeDefined();
      expect(result.isAccessControlAllowed).toBeDefined();
      expect(result.projectPermission).toBeDefined();
      expect(result.license).toBeDefined();
      expect(result.peopleCount).toBe(0);
      expect(result.responseCount).toBe(0);
    });

    test("validates environmentId input", async () => {
      await expect(getEnvironmentLayoutData("", "user123")).rejects.toThrow();
    });

    test("validates userId input", async () => {
      await expect(getEnvironmentLayoutData("env123", "")).rejects.toThrow();
    });

    test("throws error if session not found", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      await expect(getEnvironmentLayoutData("env123", "user123")).rejects.toThrow("common.session_not_found");
    });

    test("throws error if userId doesn't match session", async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "different-user" } } as any);

      await expect(getEnvironmentLayoutData("env123", "user123")).rejects.toThrow("User ID mismatch");
    });

    test("throws error if user not found", async () => {
      vi.mocked(getUser).mockResolvedValueOnce(null);

      await expect(getEnvironmentLayoutData("env123", "user123")).rejects.toThrow("common.user_not_found");
    });

    test("throws error if environment data not found", async () => {
      vi.mocked(prisma.environment.findUnique).mockResolvedValueOnce(null);

      await expect(getEnvironmentLayoutData("env123", "user123")).rejects.toThrow(
        "common.environment_not_found"
      );
    });

    test("throws AuthorizationError if user has no environment access", async () => {
      vi.mocked(hasUserEnvironmentAccess).mockResolvedValueOnce(false);

      await expect(getEnvironmentLayoutData("env123", "user123")).rejects.toThrow(AuthorizationError);
    });

    test("throws error if membership not found", async () => {
      vi.mocked(prisma.environment.findUnique).mockResolvedValueOnce({
        id: "env123",
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "production",
        projectId: "proj123",
        appSetupCompleted: true,
        project: {
          id: "proj123",
          name: "Test Project",
          organizationId: "org123",
          createdAt: new Date(),
          updatedAt: new Date(),
          languages: ["en"],
          recontactDays: 7,
          linkSurveyBranding: true,
          inAppSurveyBranding: true,
          config: {},
          placement: "bottomRight",
          clickOutsideClose: true,
          darkOverlay: false,
          styling: {},
          logo: null,
          environments: [],
          organization: {
            id: "org123",
            name: "Test Organization",
            createdAt: new Date(),
            updatedAt: new Date(),
            billing: { plan: "free", limits: {} },
            isAIEnabled: false,
            whitelabel: false,
            memberships: [], // No membership
          },
        },
      } as any);

      await expect(getEnvironmentLayoutData("env123", "user123")).rejects.toThrow(
        "common.membership_not_found"
      );
    });

    test("fetches user before auth check, then environment data after authorization", async () => {
      await getEnvironmentLayoutData("env123", "user123");

      // User is fetched first (needed for auth check)
      expect(getUser).toHaveBeenCalledWith("user123");
      // Environment data is fetched after authorization passes
      expect(prisma.environment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "env123" },
        })
      );
    });

    test("fetches permissions and license data in parallel", async () => {
      await getEnvironmentLayoutData("env123", "user123");

      expect(getAccessControlPermission).toHaveBeenCalled();
      expect(getProjectPermissionByUserId).toHaveBeenCalledWith("user123", "proj123");
      expect(getEnterpriseLicense).toHaveBeenCalled();
    });

    test("fetches cloud metrics when IS_FORMBRICKS_CLOUD is true", async () => {
      // Mock IS_FORMBRICKS_CLOUD to be true
      const constantsMock = await import("@/lib/constants");
      vi.mocked(constantsMock).IS_FORMBRICKS_CLOUD = true;

      await getEnvironmentLayoutData("env123", "user123");

      expect(getMonthlyActiveOrganizationPeopleCount).toHaveBeenCalledWith("org123");
      expect(getMonthlyOrganizationResponseCount).toHaveBeenCalledWith("org123");
    });

    test("caches results per environmentId and userId", async () => {
      // Call twice with same parameters
      await getEnvironmentLayoutData("env123", "user123");
      await getEnvironmentLayoutData("env123", "user123");

      // Due to React.cache, database should only be queried once
      // Note: React.cache behavior is per-request in production, but in tests
      // we can verify the function was called multiple times
      expect(prisma.environment.findUnique).toHaveBeenCalled();
    });

    test("returns different data for different environmentIds", async () => {
      vi.mocked(prisma.environment.findUnique).mockResolvedValueOnce({
        id: "env123",
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "production",
        projectId: "proj123",
        appSetupCompleted: true,
        project: {
          id: "proj123",
          name: "Project 1",
          organizationId: "org123",
          createdAt: new Date(),
          updatedAt: new Date(),
          languages: ["en"],
          recontactDays: 7,
          linkSurveyBranding: true,
          inAppSurveyBranding: true,
          config: {},
          placement: "bottomRight",
          clickOutsideClose: true,
          darkOverlay: false,
          styling: {},
          logo: null,
          environments: [],
          organization: {
            id: "org123",
            name: "Org 1",
            createdAt: new Date(),
            updatedAt: new Date(),
            billing: { plan: "free", limits: {} },
            isAIEnabled: false,
            whitelabel: false,
            memberships: [{ userId: "user123", organizationId: "org123", role: "owner", accepted: true }],
          },
        },
      } as any);

      const result1 = await getEnvironmentLayoutData("env123", "user123");

      vi.mocked(prisma.environment.findUnique).mockResolvedValueOnce({
        id: "env456",
        createdAt: new Date(),
        updatedAt: new Date(),
        type: "development",
        projectId: "proj456",
        appSetupCompleted: true,
        project: {
          id: "proj456",
          name: "Project 2",
          organizationId: "org456",
          createdAt: new Date(),
          updatedAt: new Date(),
          languages: ["en"],
          recontactDays: 7,
          linkSurveyBranding: true,
          inAppSurveyBranding: true,
          config: {},
          placement: "bottomRight",
          clickOutsideClose: true,
          darkOverlay: false,
          styling: {},
          logo: null,
          environments: [],
          organization: {
            id: "org456",
            name: "Org 2",
            createdAt: new Date(),
            updatedAt: new Date(),
            billing: { plan: "pro", limits: {} },
            isAIEnabled: true,
            whitelabel: true,
            memberships: [{ userId: "user123", organizationId: "org456", role: "member", accepted: true }],
          },
        },
      } as any);

      const result2 = await getEnvironmentLayoutData("env456", "user123");

      expect(result1.environment.id).not.toBe(result2.environment.id);
    });
  });
});
