import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { archiveSurvey, deleteSurvey, restoreSurvey } from "./surveys";

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    survey: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const surveyId = "clq5n7p1q0000m7z0h5p6g3r2";
const workspaceId = "clq5n7p1q0000m7z0h5p6g3r3";
const segmentId = "clq5n7p1q0000m7z0h5p6g3r4";
const actionClassId1 = "clq5n7p1q0000m7z0h5p6g3r5";
const actionClassId2 = "clq5n7p1q0000m7z0h5p6g3r6";

const mockDeletedSurveyAppPrivateSegment = {
  id: surveyId,
  workspaceId,
  type: "app",
  segment: { id: segmentId, isPrivate: true },
  triggers: [{ actionClass: { id: actionClassId1 } }, { actionClass: { id: actionClassId2 } }],
};

const mockDeletedSurveyLink = {
  id: surveyId,
  workspaceId,
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

  test("skips the guarded delete when the survey was restored before the purge deletes it", async () => {
    const cutoff = new Date("2026-07-01T00:00:00.000Z");
    const queryRawMock = vi.fn().mockResolvedValue([]);
    // archivedAt cleared -> restored between batch selection and delete.
    const findUniqueMock = vi.fn().mockResolvedValue({ archivedAt: null });
    const deleteMock = vi.fn();

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({
        $queryRaw: queryRawMock,
        survey: { findUnique: findUniqueMock, delete: deleteMock },
        segment: { delete: vi.fn() },
      } as never)
    );

    await expect(deleteSurvey(surveyId, { requireArchivedBefore: cutoff })).rejects.toThrow(
      ResourceNotFoundError
    );
    expect(queryRawMock).toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  test("performs the guarded delete when the survey is still archived before the cutoff", async () => {
    const cutoff = new Date("2026-07-01T00:00:00.000Z");
    const queryRawMock = vi.fn().mockResolvedValue([]);
    const findUniqueMock = vi.fn().mockResolvedValue({ archivedAt: new Date("2026-05-01T00:00:00.000Z") });
    const deleteMock = vi.fn().mockResolvedValue(mockDeletedSurveyLink);

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({
        $queryRaw: queryRawMock,
        survey: { findUnique: findUniqueMock, delete: deleteMock },
        segment: { delete: vi.fn() },
      } as never)
    );

    const result = await deleteSurvey(surveyId, { requireArchivedBefore: cutoff });

    expect(queryRawMock).toHaveBeenCalled();
    expect(deleteMock).toHaveBeenCalled();
    expect(result).toEqual(mockDeletedSurveyLink);
  });
});

describe("archiveSurvey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should archive an inProgress survey by pausing it and clearing publishOn", async () => {
    const findUniqueMock = vi
      .fn()
      .mockResolvedValue({ id: surveyId, status: "inProgress", archivedAt: null });
    const updateMock = vi.fn().mockResolvedValue({ id: surveyId, status: "paused", archivedAt: new Date() });

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({ survey: { findUnique: findUniqueMock, update: updateMock } } as never)
    );

    await archiveSurvey(surveyId);

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: surveyId },
      data: { archivedAt: expect.any(Date), publishOn: null, status: "paused" },
      select: { id: true, status: true, archivedAt: true },
    });
  });

  test("should archive a paused survey without changing its status", async () => {
    const findUniqueMock = vi.fn().mockResolvedValue({ id: surveyId, status: "paused", archivedAt: null });
    const updateMock = vi.fn().mockResolvedValue({ id: surveyId, status: "paused", archivedAt: new Date() });

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({ survey: { findUnique: findUniqueMock, update: updateMock } } as never)
    );

    await archiveSurvey(surveyId);

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: surveyId },
      data: { archivedAt: expect.any(Date), publishOn: null },
      select: { id: true, status: true, archivedAt: true },
    });
  });

  test("should be a no-op when the survey is already archived", async () => {
    const alreadyArchived = { id: surveyId, status: "paused", archivedAt: new Date() };
    const findUniqueMock = vi.fn().mockResolvedValue(alreadyArchived);
    const updateMock = vi.fn();

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({ survey: { findUnique: findUniqueMock, update: updateMock } } as never)
    );

    const result = await archiveSurvey(surveyId);

    expect(updateMock).not.toHaveBeenCalled();
    expect(result).toEqual(alreadyArchived);
  });

  test("should throw ResourceNotFoundError when the survey does not exist", async () => {
    const findUniqueMock = vi.fn().mockResolvedValue(null);

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({ survey: { findUnique: findUniqueMock, update: vi.fn() } } as never)
    );

    await expect(archiveSurvey(surveyId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should map Prisma P2025 during archive to ResourceNotFoundError", async () => {
    // A concurrent delete between findUnique and update raises P2025; match restoreSurvey's contract.
    const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "4.0.0",
    });
    vi.mocked(prisma.$transaction).mockRejectedValue(prismaError);

    await expect(archiveSurvey(surveyId)).rejects.toThrow(ResourceNotFoundError);
    expect(logger.warn).toHaveBeenCalledWith({ surveyId }, "Survey not found during archive");
  });
});

describe("restoreSurvey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should restore a survey by clearing archivedAt", async () => {
    vi.mocked(prisma.survey.update).mockResolvedValue({
      id: surveyId,
      status: "paused",
      archivedAt: null,
    } as never);

    await restoreSurvey(surveyId);

    expect(prisma.survey.update).toHaveBeenCalledWith({
      where: { id: surveyId },
      data: { archivedAt: null },
      select: { id: true, status: true, archivedAt: true },
    });
  });

  test("should map Prisma P2025 during restore to ResourceNotFoundError", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Record not found", {
      code: "P2025",
      clientVersion: "4.0.0",
    });
    vi.mocked(prisma.survey.update).mockRejectedValue(prismaError);

    await expect(restoreSurvey(surveyId)).rejects.toThrow(ResourceNotFoundError);
  });

  test("should map a non-P2025 PrismaClientKnownRequestError during restore to DatabaseError", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Constraint failed", {
      code: "P2003",
      clientVersion: "4.0.0",
    });
    vi.mocked(prisma.survey.update).mockRejectedValue(prismaError);

    await expect(restoreSurvey(surveyId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith({ error: prismaError, surveyId }, "Error restoring survey");
  });
});
