import { segmentCache } from "@/lib/cache/segment";
import { responseCache } from "@/lib/response/cache";
import { surveyCache } from "@/lib/survey/cache";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";
import { deleteSurvey } from "./surveys";

// Mock dependencies
vi.mock("@/lib/cache/segment", () => ({
  segmentCache: {
    revalidate: vi.fn(),
  },
}));
vi.mock("@/lib/response/cache", () => ({
  responseCache: {
    revalidate: vi.fn(),
  },
}));
vi.mock("@/lib/survey/cache", () => ({
  surveyCache: {
    revalidate: vi.fn(),
  },
}));
vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    survey: {
      delete: vi.fn(),
    },
    segment: {
      delete: vi.fn(),
    },
  },
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

const surveyId = "clq5n7p1q0000m7z0h5p6g3r2";
const environmentId = "clq5n7p1q0000m7z0h5p6g3r3";
const segmentId = "clq5n7p1q0000m7z0h5p6g3r4";
const actionClassId1 = "clq5n7p1q0000m7z0h5p6g3r5";
const actionClassId2 = "clq5n7p1q0000m7z0h5p6g3r6";

const mockDeletedSurveyAppPrivateSegment = {
  id: surveyId,
  environmentId,
  type: "app",
  segment: { id: segmentId, isPrivate: true },
  triggers: [{ actionClass: { id: actionClassId1 } }, { actionClass: { id: actionClassId2 } }],
  resultShareKey: "shareKey123",
};

const mockDeletedSurveyLink = {
  id: surveyId,
  environmentId,
  type: "link",
  segment: null,
  triggers: [],
  resultShareKey: null,
};

describe("deleteSurvey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should delete a link survey without a segment and revalidate caches", async () => {
    vi.mocked(prisma.survey.delete).mockResolvedValue(mockDeletedSurveyLink as any);

    const deletedSurvey = await deleteSurvey(surveyId);

    expect(validateInputs).toHaveBeenCalledWith([surveyId, expect.any(Object)]);
    expect(prisma.survey.delete).toHaveBeenCalledWith({
      where: { id: surveyId },
      include: {
        segment: true,
        triggers: { include: { actionClass: true } },
      },
    });
    expect(prisma.segment.delete).not.toHaveBeenCalled();
    expect(segmentCache.revalidate).not.toHaveBeenCalled(); // No segment to revalidate
    expect(responseCache.revalidate).toHaveBeenCalledWith({ surveyId, environmentId });
    expect(surveyCache.revalidate).toHaveBeenCalledTimes(1); // Only for surveyId
    expect(surveyCache.revalidate).toHaveBeenCalledWith({
      id: surveyId,
      environmentId,
      resultShareKey: undefined,
    });
    expect(deletedSurvey).toEqual(mockDeletedSurveyLink);
  });

  test("should handle PrismaClientKnownRequestError during survey deletion", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "4.0.0",
    });
    vi.mocked(prisma.survey.delete).mockRejectedValue(prismaError);

    await expect(deleteSurvey(surveyId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith({ error: prismaError, surveyId }, "Error deleting survey");
    expect(prisma.segment.delete).not.toHaveBeenCalled();
    expect(segmentCache.revalidate).not.toHaveBeenCalled();
    expect(responseCache.revalidate).not.toHaveBeenCalled();
    expect(surveyCache.revalidate).not.toHaveBeenCalled();
  });

  test("should handle PrismaClientKnownRequestError during segment deletion", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
      code: "P2003",
      clientVersion: "4.0.0",
    });
    vi.mocked(prisma.survey.delete).mockResolvedValue(mockDeletedSurveyAppPrivateSegment as any);
    vi.mocked(prisma.segment.delete).mockRejectedValue(prismaError);

    await expect(deleteSurvey(surveyId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith({ error: prismaError, surveyId }, "Error deleting survey");
    expect(prisma.segment.delete).toHaveBeenCalledWith({ where: { id: segmentId } });
    // Caches might have been partially revalidated before the error
  });

  test("should handle generic errors during deletion", async () => {
    const genericError = new Error("Something went wrong");
    vi.mocked(prisma.survey.delete).mockRejectedValue(genericError);

    await expect(deleteSurvey(surveyId)).rejects.toThrow(genericError);
    expect(logger.error).not.toHaveBeenCalled(); // Should not log generic errors here
    expect(prisma.segment.delete).not.toHaveBeenCalled();
  });

  test("should throw validation error for invalid surveyId", async () => {
    const invalidSurveyId = "invalid-id";
    const validationError = new Error("Validation failed");
    vi.mocked(validateInputs).mockImplementation(() => {
      throw validationError;
    });

    await expect(deleteSurvey(invalidSurveyId)).rejects.toThrow(validationError);
    expect(prisma.survey.delete).not.toHaveBeenCalled();
  });
});
