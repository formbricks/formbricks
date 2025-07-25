import { BILLING_LIMITS, PROJECT_FEATURE_KEYS } from "@/lib/constants";
import { updateUser } from "@/lib/user/service";
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import {
  createOrganization,
  getOrganization,
  getOrganizationsByUserId,
  subscribeOrganizationMembersToSurveyResponses,
  updateOrganization,
} from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/user/service", () => ({
  updateUser: vi.fn(),
}));

describe("Organization Service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrganization", () => {
    test("should return organization when found", async () => {
      const mockOrganization = {
        id: "org1",
        name: "Test Org",
        createdAt: new Date(),
        updatedAt: new Date(),
        billing: {
          plan: PROJECT_FEATURE_KEYS.FREE,
          limits: {
            projects: BILLING_LIMITS.FREE.PROJECTS,
            monthly: {
              responses: BILLING_LIMITS.FREE.RESPONSES,
              miu: BILLING_LIMITS.FREE.MIU,
            },
          },
          stripeCustomerId: null,
          periodStart: new Date(),
          period: "monthly" as const,
        },
        isAIEnabled: false,
        whitelabel: false,
      };

      vi.mocked(prisma.organization.findUnique).mockResolvedValue(mockOrganization);

      const result = await getOrganization("org1");

      expect(result).toEqual(mockOrganization);
      expect(prisma.organization.findUnique).toHaveBeenCalledWith({
        where: { id: "org1" },
        select: expect.any(Object),
      });
    });

    test("should return null when organization not found", async () => {
      vi.mocked(prisma.organization.findUnique).mockResolvedValue(null);

      const result = await getOrganization("nonexistent");

      expect(result).toBeNull();
    });

    test("should throw DatabaseError on prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.organization.findUnique).mockRejectedValue(prismaError);

      await expect(getOrganization("org1")).rejects.toThrow(DatabaseError);
    });
  });

  describe("getOrganizationsByUserId", () => {
    test("should return organizations for user", async () => {
      const mockOrganizations = [
        {
          id: "org1",
          name: "Test Org 1",
          createdAt: new Date(),
          updatedAt: new Date(),
          billing: {
            plan: PROJECT_FEATURE_KEYS.FREE,
            limits: {
              projects: BILLING_LIMITS.FREE.PROJECTS,
              monthly: {
                responses: BILLING_LIMITS.FREE.RESPONSES,
                miu: BILLING_LIMITS.FREE.MIU,
              },
            },
            stripeCustomerId: null,
            periodStart: new Date(),
            period: "monthly" as const,
          },
          isAIEnabled: false,
          whitelabel: false,
        },
      ];

      vi.mocked(prisma.organization.findMany).mockResolvedValue(mockOrganizations);

      const result = await getOrganizationsByUserId("user1");

      expect(result).toEqual(mockOrganizations);
      expect(prisma.organization.findMany).toHaveBeenCalledWith({
        where: {
          memberships: {
            some: {
              userId: "user1",
            },
          },
        },
        select: expect.any(Object),
      });
    });

    test("should throw DatabaseError on prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.organization.findMany).mockRejectedValue(prismaError);

      await expect(getOrganizationsByUserId("user1")).rejects.toThrow(DatabaseError);
    });
  });

  describe("createOrganization", () => {
    test("should create organization with default billing settings", async () => {
      const mockOrganization = {
        id: "org1",
        name: "Test Org",
        createdAt: new Date(),
        updatedAt: new Date(),
        billing: {
          plan: PROJECT_FEATURE_KEYS.FREE,
          limits: {
            projects: BILLING_LIMITS.FREE.PROJECTS,
            monthly: {
              responses: BILLING_LIMITS.FREE.RESPONSES,
              miu: BILLING_LIMITS.FREE.MIU,
            },
          },
          stripeCustomerId: null,
          periodStart: new Date(),
          period: "monthly" as const,
        },
        isAIEnabled: false,
        whitelabel: false,
      };

      vi.mocked(prisma.organization.create).mockResolvedValue(mockOrganization);

      const result = await createOrganization({ name: "Test Org" });

      expect(result).toEqual(mockOrganization);
      expect(prisma.organization.create).toHaveBeenCalledWith({
        data: {
          name: "Test Org",
          billing: {
            plan: PROJECT_FEATURE_KEYS.FREE,
            limits: {
              projects: BILLING_LIMITS.FREE.PROJECTS,
              monthly: {
                responses: BILLING_LIMITS.FREE.RESPONSES,
                miu: BILLING_LIMITS.FREE.MIU,
              },
            },
            stripeCustomerId: null,
            periodStart: expect.any(Date),
            period: "monthly",
          },
        },
        select: expect.any(Object),
      });
    });

    test("should throw DatabaseError on prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.organization.create).mockRejectedValue(prismaError);

      await expect(createOrganization({ name: "Test Org" })).rejects.toThrow(DatabaseError);
    });
  });

  describe("updateOrganization", () => {
    test("should update organization and revalidate cache", async () => {
      const mockOrganization = {
        id: "org1",
        name: "Updated Org",
        createdAt: new Date(),
        updatedAt: new Date(),
        billing: {
          plan: PROJECT_FEATURE_KEYS.FREE,
          limits: {
            projects: BILLING_LIMITS.FREE.PROJECTS,
            monthly: {
              responses: BILLING_LIMITS.FREE.RESPONSES,
              miu: BILLING_LIMITS.FREE.MIU,
            },
          },
          stripeCustomerId: null,
          periodStart: new Date(),
          period: "monthly" as const,
        },
        isAIEnabled: false,
        whitelabel: false,
        memberships: [{ userId: "user1" }, { userId: "user2" }],
        projects: [
          {
            environments: [{ id: "env1" }, { id: "env2" }],
          },
        ],
      };

      vi.mocked(prisma.organization.update).mockResolvedValue(mockOrganization);

      const result = await updateOrganization("org1", { name: "Updated Org" });

      expect(result).toEqual({
        id: "org1",
        name: "Updated Org",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        billing: {
          plan: PROJECT_FEATURE_KEYS.FREE,
          limits: {
            projects: BILLING_LIMITS.FREE.PROJECTS,
            monthly: {
              responses: BILLING_LIMITS.FREE.RESPONSES,
              miu: BILLING_LIMITS.FREE.MIU,
            },
          },
          stripeCustomerId: null,
          periodStart: expect.any(Date),
          period: "monthly",
        },
        isAIEnabled: false,
        whitelabel: false,
      });
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "org1" },
        data: { name: "Updated Org" },
        select: expect.any(Object),
      });
    });
  });

  describe("subscribeOrganizationMembersToSurveyResponses", () => {
    test("should subscribe user to survey responses when not unsubscribed", async () => {
      const mockUser = {
        id: "user-123",
        notificationSettings: {
          alert: { "existing-survey-id": true },
          unsubscribedOrganizationIds: [], // User is subscribed to all organizations
        },
      } as any;

      const surveyId = "survey-123";
      const userId = "user-123";
      const organizationId = "org-123";

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);
      vi.mocked(updateUser).mockResolvedValueOnce({} as any);

      await subscribeOrganizationMembersToSurveyResponses(surveyId, userId, organizationId);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(updateUser).toHaveBeenCalledWith(userId, {
        notificationSettings: {
          alert: {
            "existing-survey-id": true,
            "survey-123": true,
          },

          unsubscribedOrganizationIds: [],
        },
      });
    });

    test("should not subscribe user when unsubscribed from organization", async () => {
      const mockUser = {
        id: "user-123",
        notificationSettings: {
          alert: { "existing-survey-id": true },
          unsubscribedOrganizationIds: ["org-123"], // User has unsubscribed from this organization
        },
      } as any;

      const surveyId = "survey-123";
      const userId = "user-123";
      const organizationId = "org-123";

      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser);

      await subscribeOrganizationMembersToSurveyResponses(surveyId, userId, organizationId);

      // Should not call updateUser because user is unsubscribed from this organization
      expect(updateUser).not.toHaveBeenCalled();
    });
  });
});
