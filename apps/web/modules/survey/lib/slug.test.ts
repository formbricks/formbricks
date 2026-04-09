import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getSurveyBySlug, getSurveysWithSlugsByOrganizationId, updateSurveySlug } from "./slug";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("Slug Library Tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getSurveyBySlug", () => {
    test("should return survey when found", async () => {
      const mockSurvey = { id: "survey_123", environmentId: "env_123", status: "inProgress" };
      vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce(mockSurvey as never);

      const result = await getSurveyBySlug("test-slug");
      expect(result).toEqual(mockSurvey);
      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { slug: "test-slug" },
        select: { id: true, environmentId: true, status: true },
      });
    });

    test("should return null when survey not found", async () => {
      vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce(null);

      const result = await getSurveyBySlug("nonexistent");
      expect(result).toBeNull();
    });

    test("should throw DatabaseError when prisma fails", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P1001",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.survey.findUnique).mockRejectedValueOnce(prismaError);

      await expect(getSurveyBySlug("error-slug")).rejects.toThrow(DatabaseError);
    });
  });

  describe("updateSurveySlug", () => {
    test("should update slug successfully", async () => {
      const mockResult = { id: "survey_123", slug: "new-slug" };
      vi.mocked(prisma.survey.update).mockResolvedValueOnce(mockResult as never);

      const result = await updateSurveySlug("survey_123", "new-slug");
      expect(result).toEqual(mockResult);
      expect(prisma.survey.update).toHaveBeenCalledWith({
        where: { id: "survey_123" },
        data: { slug: "new-slug" },
        select: { id: true, slug: true },
      });
    });

    test("should throw InvalidInputError on P2002 (unique constraint)", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Conflict", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.survey.update).mockRejectedValue(prismaError);

      await expect(updateSurveySlug("survey_123", "taken-slug")).rejects.toThrow(InvalidInputError);
      await expect(updateSurveySlug("survey_123", "taken-slug")).rejects.toThrow(
        "A survey with this slug already exists"
      );
    });

    test("should throw ResourceNotFoundError on P2025", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Not found", {
        code: "P2025",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.survey.update).mockRejectedValueOnce(prismaError);

      await expect(updateSurveySlug("nonexistent", "new-slug")).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError on other prisma errors", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Unexpected error", {
        code: "P1001",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.survey.update).mockRejectedValueOnce(prismaError);

      await expect(updateSurveySlug("survey_123", "new-slug")).rejects.toThrow(DatabaseError);
    });
  });

  describe("getSurveysWithSlugsByOrganizationId", () => {
    test("should return surveys with slugs", async () => {
      const mockSurveys = [
        {
          id: "survey_1",
          name: "Survey 1",
          slug: "slug-1",
          status: "inProgress",
          createdAt: new Date(),
          environment: {
            id: "env_1",
            type: "production",
            project: { id: "proj_1", name: "Project 1" },
          },
        },
      ];
      vi.mocked(prisma.survey.findMany).mockResolvedValueOnce(mockSurveys as never);

      const result = await getSurveysWithSlugsByOrganizationId("org_123");
      expect(result).toEqual(mockSurveys);
      expect(prisma.survey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            slug: { not: null },
            environment: { project: { organizationId: "org_123" } },
          },
        })
      );
    });

    test("should throw DatabaseError when prisma fails", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
        code: "P1001",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.survey.findMany).mockRejectedValueOnce(prismaError);

      await expect(getSurveysWithSlugsByOrganizationId("org_123")).rejects.toThrow(DatabaseError);
    });
  });
});
