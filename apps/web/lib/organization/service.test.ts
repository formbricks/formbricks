import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { updateUser } from "@/lib/user/service";
import {
  cleanupStripeCustomer,
  ensureCloudStripeSetupForOrganization,
} from "@/modules/ee/billing/lib/organization-billing";
import {
  createOrganization,
  deleteOrganization,
  getOrganization,
  getOrganizationsByUserId,
  select as organizationSelect,
  subscribeOrganizationMembersToSurveyResponses,
  updateOrganization,
} from "./service";

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    organization: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    organizationBilling: {
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/user/service", () => ({
  updateUser: vi.fn(),
}));

vi.mock("@/modules/ee/billing/lib/organization-billing", () => ({
  ensureCloudStripeSetupForOrganization: vi.fn().mockResolvedValue(undefined),
  cleanupStripeCustomer: vi.fn().mockResolvedValue(undefined),
}));

describe("Organization Service", () => {
  beforeEach(() => {
    vi.mocked(ensureCloudStripeSetupForOrganization).mockResolvedValue(undefined);
  });

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
          limits: {
            projects: 3,
            monthly: {
              responses: 1500,
            },
          },
          stripeCustomerId: null,
          usageCycleAnchor: new Date(),
        },
        isAISmartToolsEnabled: false,
        isAIDataAnalysisEnabled: false,
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
            limits: {
              projects: 3,
              monthly: {
                responses: 1500,
              },
            },
            stripeCustomerId: null,
            usageCycleAnchor: new Date(),
          },
          isAISmartToolsEnabled: false,
          isAIDataAnalysisEnabled: false,
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
      const expectedBilling = {
        limits: {
          projects: IS_FORMBRICKS_CLOUD ? 1 : 3,
          monthly: {
            responses: IS_FORMBRICKS_CLOUD ? 250 : 1500,
          },
        },
        stripeCustomerId: null,
        usageCycleAnchor: null,
      };

      const mockOrganization = {
        id: "org1",
        name: "Test Org",
        createdAt: new Date(),
        updatedAt: new Date(),
        billing: expectedBilling,
        isAISmartToolsEnabled: false,
        isAIDataAnalysisEnabled: false,
        whitelabel: false,
      };

      vi.mocked(prisma.organization.create).mockResolvedValue(mockOrganization);

      const result = await createOrganization({ name: "Test Org" });

      expect(result).toEqual(mockOrganization);
      expect(prisma.organization.create).toHaveBeenCalledWith({
        data: {
          name: "Test Org",
          billing: {
            create: {
              limits: {
                projects: IS_FORMBRICKS_CLOUD ? 1 : 3,
                monthly: {
                  responses: IS_FORMBRICKS_CLOUD ? 250 : 1500,
                },
              },
              stripeCustomerId: null,
              usageCycleAnchor: null,
            },
          },
        },
        select: organizationSelect,
      });
      // Stripe setup is now handled by the caller after membership creation
      expect(ensureCloudStripeSetupForOrganization).not.toHaveBeenCalled();
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
          limits: {
            projects: 3,
            monthly: {
              responses: 1500,
            },
          },
          stripeCustomerId: null,
          usageCycleAnchor: new Date(),
        },
        isAISmartToolsEnabled: false,
        isAIDataAnalysisEnabled: false,
        whitelabel: false,
        memberships: [{ userId: "user1" }, { userId: "user2" }],
        projects: [
          {
            environments: [{ id: "env1" }, { id: "env2" }],
          },
        ],
      };

      vi.mocked(prisma.organization.update).mockResolvedValue(mockOrganization);
      vi.mocked(prisma.$transaction).mockImplementation(
        async (fn: any) =>
          await fn({
            organization: {
              update: prisma.organization.update,
              findUnique: vi.fn().mockResolvedValue(mockOrganization),
            },
            organizationBilling: {
              upsert: prisma.organizationBilling.upsert,
            },
          })
      );

      const result = await updateOrganization("org1", { name: "Updated Org" });

      expect(result).toMatchObject({
        id: "org1",
        name: "Updated Org",
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        billing: {
          limits: {
            projects: 3,
            monthly: {
              responses: 1500,
            },
          },
          stripeCustomerId: null,
          usageCycleAnchor: expect.any(Date),
        },
        isAISmartToolsEnabled: false,
        isAIDataAnalysisEnabled: false,
        whitelabel: false,
      });
      expect(prisma.organization.update).toHaveBeenCalledWith({
        where: { id: "org1" },
        data: { name: "Updated Org" },
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

  describe("deleteOrganization", () => {
    test("should call cleanupStripeCustomer when cloud and stripeCustomerId exists", async () => {
      vi.mocked(prisma.organization.delete).mockResolvedValue({
        id: "org1",
        name: "Test Org",
        billing: { stripeCustomerId: "cus_123" },
        memberships: [],
        projects: [],
      } as any);

      await deleteOrganization("org1");

      if (IS_FORMBRICKS_CLOUD) {
        expect(cleanupStripeCustomer).toHaveBeenCalledWith("cus_123");
      }
    });
  });
});
