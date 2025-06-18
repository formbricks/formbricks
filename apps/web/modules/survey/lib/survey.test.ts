import { Organization, Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getOrganizationBilling, getSurvey } from "./survey";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: {
      findFirst: vi.fn(),
    },
    survey: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock transformPrismaSurvey
vi.mock("@/modules/survey/lib/utils", () => ({
  transformPrismaSurvey: vi.fn((survey) => survey),
}));

describe("Survey Library Tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getOrganizationBilling", () => {
    test("should return organization billing when found", async () => {
      const mockBilling = {
        stripeCustomerId: "cus_123",
        features: { linkSurvey: { status: "active" } },
        subscriptionStatus: "active",
        nextRenewalDate: new Date(),
      } as unknown as Organization["billing"];
      vi.mocked(prisma.organization.findFirst).mockResolvedValueOnce({ billing: mockBilling } as any);

      const billing = await getOrganizationBilling("org_123");
      expect(billing).toEqual(mockBilling);
      expect(prisma.organization.findFirst).toHaveBeenCalledWith({
        where: { id: "org_123" },
        select: { billing: true },
      });
    });

    test("should throw ResourceNotFoundError when organization not found", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValueOnce(null);
      await expect(getOrganizationBilling("org_nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError on Prisma client known request error", async () => {
      const mockErrorMessage = "Prisma error";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.organization.findFirst).mockRejectedValue(errToThrow);
      await expect(getOrganizationBilling("org_dberror")).rejects.toThrow(DatabaseError);
    });

    test("should throw other errors", async () => {
      const genericError = new Error("Generic error");
      vi.mocked(prisma.organization.findFirst).mockRejectedValueOnce(genericError);
      await expect(getOrganizationBilling("org_error")).rejects.toThrow(genericError);
    });
  });

  describe("getSurvey", () => {
    test("should return survey when found", async () => {
      const mockSurvey = { id: "survey_123", name: "Test Survey" } as unknown as TSurvey;
      vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce(mockSurvey as any); // Type assertion needed due to complex select

      const survey = await getSurvey("survey_123");
      expect(survey).toEqual(mockSurvey);
      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { id: "survey_123" },
        select: expect.any(Object), // selectSurvey is a large object, checking for existence
      });
    });

    test("should throw ResourceNotFoundError when survey not found", async () => {
      vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce(null);
      await expect(getSurvey("survey_nonexistent")).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError on Prisma client known request error", async () => {
      const mockErrorMessage = "Prisma error";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      vi.mocked(prisma.survey.findUnique).mockRejectedValue(errToThrow);
      await expect(getSurvey("survey_dberror")).rejects.toThrow(DatabaseError);
    });

    test("should throw other errors", async () => {
      const genericError = new Error("Generic error");
      vi.mocked(prisma.survey.findUnique).mockRejectedValueOnce(genericError);
      await expect(getSurvey("survey_error")).rejects.toThrow(genericError);
    });
  });
});
