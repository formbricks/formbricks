import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { deleteSurvey } from "./surveys";

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
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
};

const mockDeletedSurveyLink = {
  id: surveyId,
  environmentId,
  type: "link",
  segment: null,
  triggers: [],
};

describe("deleteSurvey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should delete a link survey without a segment", async () => {
    const deleteMock = vi.fn().mockResolvedValue(mockDeletedSurveyLink);
    const segmentDeleteMock = vi.fn();

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({
        survey: { delete: deleteMock },
        segment: { delete: segmentDeleteMock },
      } as never)
    );

    const deletedSurvey = await deleteSurvey(surveyId);

    expect(validateInputs).toHaveBeenCalledWith([surveyId, expect.any(Object)]);
    expect(deleteMock).toHaveBeenCalledWith({
      where: { id: surveyId },
      include: {
        segment: true,
        triggers: { include: { actionClass: true } },
      },
    });
    expect(segmentDeleteMock).not.toHaveBeenCalled();
    expect(deletedSurvey).toEqual(mockDeletedSurveyLink);
  });

  test("should delete a private segment for app surveys", async () => {
    const deleteMock = vi.fn().mockResolvedValue(mockDeletedSurveyAppPrivateSegment);
    const segmentDeleteMock = vi.fn().mockResolvedValue({ id: segmentId });

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({
        survey: { delete: deleteMock },
        segment: { delete: segmentDeleteMock },
      } as never)
    );

    const deletedSurvey = await deleteSurvey(surveyId);

    expect(segmentDeleteMock).toHaveBeenCalledWith({ where: { id: segmentId } });
    expect(deletedSurvey).toEqual(mockDeletedSurveyAppPrivateSegment);
  });

  test("should map Prisma P2025 during survey deletion to ResourceNotFoundError", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "4.0.0",
    });
    vi.mocked(prisma.$transaction).mockRejectedValue(prismaError);

    await expect(deleteSurvey(surveyId)).rejects.toThrow(ResourceNotFoundError);
    expect(logger.warn).toHaveBeenCalledWith({ surveyId }, "Survey not found during delete");
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("should handle non-P2025 PrismaClientKnownRequestError during survey deletion", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Constraint failed", {
      code: "P2003",
      clientVersion: "4.0.0",
    });
    vi.mocked(prisma.$transaction).mockRejectedValue(prismaError);

    await expect(deleteSurvey(surveyId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith({ error: prismaError, surveyId }, "Error deleting survey");
  });

  test("should handle generic errors during deletion", async () => {
    const genericError = new Error("Something went wrong");
    vi.mocked(prisma.$transaction).mockRejectedValue(genericError);

    await expect(deleteSurvey(surveyId)).rejects.toThrow(genericError);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("should throw validation error for invalid surveyId", async () => {
    const invalidSurveyId = "invalid-id";
    const validationError = new Error("Validation failed");
    vi.mocked(validateInputs).mockImplementation(() => {
      throw validationError;
    });

    await expect(deleteSurvey(invalidSurveyId)).rejects.toThrow(validationError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
