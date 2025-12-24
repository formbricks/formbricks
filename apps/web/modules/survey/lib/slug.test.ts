import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ResourceNotFoundError, UniqueConstraintError } from "@formbricks/types/errors";
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
      vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce(mockSurvey as any);

      const result = await getSurveyBySlug("test-slug");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockSurvey);
      }
      expect(prisma.survey.findUnique).toHaveBeenCalledWith({
        where: { slug: "test-slug" },
        select: { id: true, environmentId: true, status: true },
      });
    });

    test("should return null when survey not found", async () => {
      vi.mocked(prisma.survey.findUnique).mockResolvedValueOnce(null);

      const result = await getSurveyBySlug("nonexistent");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeNull();
      }
    });

    test("should return DatabaseError when prisma fails", async () => {
      vi.mocked(prisma.survey.findUnique).mockRejectedValueOnce(new Error("DB error"));

      const result = await getSurveyBySlug("error-slug");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
        expect(result.error.message).toBe("DB error");
      }
    });
  });

  describe("updateSurveySlug", () => {
    test("should update slug successfully", async () => {
      const mockResult = { id: "survey_123", slug: "new-slug" };
      vi.mocked(prisma.survey.update).mockResolvedValueOnce(mockResult as any);

      const result = await updateSurveySlug("survey_123", "new-slug");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockResult);
      }
      expect(prisma.survey.update).toHaveBeenCalledWith({
        where: { id: "survey_123" },
        data: { slug: "new-slug" },
        select: { id: true, slug: true },
      });
    });

    test("should return UniqueConstraintError on P2002", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Conflict", {
        code: "P2002",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.survey.update).mockRejectedValueOnce(prismaError);

      const result = await updateSurveySlug("survey_123", "taken-slug");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(UniqueConstraintError);
      }
    });

    test("should return ResourceNotFoundError on P2025", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Not found", {
        code: "P2025",
        clientVersion: "0.0.1",
      });
      vi.mocked(prisma.survey.update).mockRejectedValueOnce(prismaError);

      const result = await updateSurveySlug("nonexistent", "new-slug");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(ResourceNotFoundError);
      }
    });

    test("should return DatabaseError on other prisma errors", async () => {
      vi.mocked(prisma.survey.update).mockRejectedValueOnce(new Error("Unexpected error"));

      const result = await updateSurveySlug("survey_123", "new-slug");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
      }
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
      vi.mocked(prisma.survey.findMany).mockResolvedValueOnce(mockSurveys as any);

      const result = await getSurveysWithSlugsByOrganizationId("org_123");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(mockSurveys);
      }
      expect(prisma.survey.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            slug: { not: null },
            environment: { project: { organizationId: "org_123" } },
          },
        })
      );
    });

    test("should return DatabaseError when prisma fails", async () => {
      vi.mocked(prisma.survey.findMany).mockRejectedValueOnce(new Error("DB error"));

      const result = await getSurveysWithSlugsByOrganizationId("org_123");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(DatabaseError);
      }
    });
  });
});
