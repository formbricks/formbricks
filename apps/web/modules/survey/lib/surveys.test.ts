import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getSurvey } from "@/lib/survey/service";
import { validateInputs } from "@/lib/utils/validate";
import { drainDeletionCleanups } from "@/modules/deletion-cleanup/lib/drain";
import { enqueueSurveyDeletionCleanups } from "@/modules/deletion-cleanup/lib/enqueue";
import { getSurveyPurgeEligibleWhere } from "@/modules/survey/archive/lib/purge-eligibility";
import { archiveSurvey, deleteSurvey, restoreSurvey } from "./surveys";

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    response: {
      findMany: vi.fn(),
    },
    survey: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@/modules/deletion-cleanup/lib/enqueue", () => ({
  enqueueSurveyDeletionCleanups: vi.fn(),
}));

vi.mock("@/modules/deletion-cleanup/lib/drain", () => ({
  drainDeletionCleanups: vi.fn(),
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
  const fileUploadElementId = "clq5n7p1q0000m7z0h5p6g3r7";
  const organizationId = "clq5n7p1q0000m7z0h5p6g3ra";
  const cutoff = new Date("2026-07-01T00:00:00.000Z");

  // getSurvey is typed TSurvey, but the scan reads only these fields, so the fixtures stop there.
  const surveyWithFileUpload = {
    workspaceId,
    questions: [],
    blocks: [
      {
        id: "clq5n7p1q0000m7z0h5p6g3r8",
        name: "Block 1",
        elements: [
          {
            id: fileUploadElementId,
            type: TSurveyElementTypeEnum.FileUpload,
            headline: { default: "Upload a file" },
            required: false,
            allowMultipleFiles: true,
          },
        ],
      },
    ],
  } as unknown as TSurvey;

  // A current upload, keyed under this survey's folder, and a pre-#8044 upload with a flat key.
  const fileUrl = (name: string) =>
    `/storage/${workspaceId}/private/surveys/${surveyId}/elements/${fileUploadElementId}/${name}`;
  const flatFileUrl = (name: string) => `/storage/${workspaceId}/private/${name}`;
  const otherSurveyFileUrl = (name: string) =>
    `/storage/${workspaceId}/private/surveys/clq5n7p1q0000m7z0h5p6g3r9/elements/${fileUploadElementId}/${name}`;

  /** A transaction whose lock finds the survey (or not) and whose eligibility re-check says `eligible`. */
  const mockTransaction = ({
    deleted = mockDeletedSurveyLink as object,
    locked = true,
    eligible = true,
  }: { deleted?: object; locked?: boolean; eligible?: boolean } = {}) => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue(locked ? [{ workspaceId, organizationId }] : []),
      survey: {
        findFirst: vi.fn().mockResolvedValue(eligible ? { id: surveyId } : null),
        delete: vi.fn().mockResolvedValue(deleted),
      },
      segment: { delete: vi.fn() },
    };
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));
    return tx;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSurvey).mockResolvedValue(surveyWithFileUpload);
    vi.mocked(prisma.survey.findFirst).mockResolvedValue({ id: surveyId } as never);
    vi.mocked(prisma.response.findMany).mockResolvedValue([
      {
        id: "response-1",
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        data: {
          [fileUploadElementId]: [fileUrl("a.png"), flatFileUrl("b.pdf"), otherSurveyFileUrl("c.png")],
          other: "not a file",
        },
      },
    ] as never);
    vi.mocked(enqueueSurveyDeletionCleanups).mockResolvedValue({ drainNowIds: ["cleanup-1"] });
    vi.mocked(drainDeletionCleanups).mockResolvedValue({ done: 1, again: 0, failed: 0 });
  });

  test("locks the survey, queues its cleanup, deletes it, then drains the storage cleanup", async () => {
    const callOrder: string[] = [];
    const tx = mockTransaction();
    tx.$queryRaw.mockImplementation(async () => {
      callOrder.push("lock");
      return [{ workspaceId, organizationId }];
    });
    tx.survey.delete.mockImplementation(async () => {
      callOrder.push("delete");
      return mockDeletedSurveyLink;
    });
    vi.mocked(prisma.response.findMany).mockImplementation((async () => {
      callOrder.push("scan");
      return [];
    }) as never);
    vi.mocked(enqueueSurveyDeletionCleanups).mockImplementation(async () => {
      callOrder.push("enqueue");
      return { drainNowIds: ["cleanup-1"] };
    });
    vi.mocked(drainDeletionCleanups).mockImplementation(async () => {
      callOrder.push("drain");
      return { done: 1, again: 0, failed: 0 };
    });

    const deleted = await deleteSurvey(surveyId);

    // The URLs live only in response.data, which the cascade takes with it, so the scan comes first,
    // outside the transaction; the cleanup is queued in the delete's transaction and drained after it.
    expect(callOrder).toEqual(["scan", "lock", "enqueue", "delete", "drain"]);
    expect(enqueueSurveyDeletionCleanups).toHaveBeenCalledWith(tx, {
      organizationId,
      workspaceId,
      surveyId,
      fileUrls: [],
    });
    expect(drainDeletionCleanups).toHaveBeenCalledWith({ ids: ["cleanup-1"] });
    expect(deleted).toEqual(mockDeletedSurveyLink);
  });

  test("queues only the flat keys one by one, leaving survey-filed keys to the folder delete", async () => {
    const tx = mockTransaction();

    await deleteSurvey(surveyId);

    // This survey's own uploads go with its folder; the other survey's upload is never ours to delete.
    expect(enqueueSurveyDeletionCleanups).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ fileUrls: [flatFileUrl("b.pdf")] })
    );
  });

  test("deletes a private segment for app surveys", async () => {
    const tx = mockTransaction({ deleted: mockDeletedSurveyAppPrivateSegment });

    await expect(deleteSurvey(surveyId)).resolves.toEqual(mockDeletedSurveyAppPrivateSegment);
    expect(tx.segment.delete).toHaveBeenCalledWith({ where: { id: segmentId } });
  });

  test("reports the survey as deleted when the drain after commit fails", async () => {
    mockTransaction();
    vi.mocked(drainDeletionCleanups).mockRejectedValue(new Error("db blip"));

    // The row is already committed as deleted and its cleanup is queued for the drain job, so a failure
    // here must not turn into an error the caller would retry against a survey that no longer exists.
    await expect(deleteSurvey(surveyId)).resolves.toEqual(mockDeletedSurveyLink);
    expect(logger.error).toHaveBeenCalled();
  });

  test("maps a survey that no longer exists to ResourceNotFoundError and queues nothing", async () => {
    const tx = mockTransaction({ locked: false });

    await expect(deleteSurvey(surveyId)).rejects.toThrow(ResourceNotFoundError);
    expect(enqueueSurveyDeletionCleanups).not.toHaveBeenCalled();
    expect(tx.survey.delete).not.toHaveBeenCalled();
    expect(drainDeletionCleanups).not.toHaveBeenCalled();
  });

  test("maps Prisma P2025 to ResourceNotFoundError", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", { code: "P2025", clientVersion: "4.0.0" })
    );

    await expect(deleteSurvey(surveyId)).rejects.toThrow(ResourceNotFoundError);
    expect(logger.warn).toHaveBeenCalledWith({ surveyId }, "Survey not found during delete");
  });

  test("maps other Prisma errors to DatabaseError and drains nothing", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Constraint failed", {
      code: "P2003",
      clientVersion: "4.0.0",
    });
    vi.mocked(prisma.$transaction).mockRejectedValue(prismaError);

    await expect(deleteSurvey(surveyId)).rejects.toThrow(DatabaseError);
    expect(logger.error).toHaveBeenCalledWith({ error: prismaError, surveyId }, "Error deleting survey");
    expect(drainDeletionCleanups).not.toHaveBeenCalled();
  });

  test("rethrows a generic error", async () => {
    const genericError = new Error("Something went wrong");
    vi.mocked(prisma.$transaction).mockRejectedValue(genericError);

    await expect(deleteSurvey(surveyId)).rejects.toThrow(genericError);
  });

  test("throws the validation error for an invalid surveyId", async () => {
    const validationError = new Error("Validation failed");
    vi.mocked(validateInputs).mockImplementationOnce(() => {
      throw validationError;
    });

    await expect(deleteSurvey("invalid-id")).rejects.toThrow(validationError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  describe("the archive purge's guard", () => {
    test("skips a survey no longer eligible before scanning its files", async () => {
      vi.mocked(prisma.survey.findFirst).mockResolvedValue(null);

      await expect(deleteSurvey(surveyId, { purgeCutoff: cutoff })).rejects.toThrow(ResourceNotFoundError);
      expect(prisma.survey.findFirst).toHaveBeenCalledWith({
        where: { id: surveyId, ...getSurveyPurgeEligibleWhere(cutoff) },
        select: { id: true },
      });
      expect(prisma.response.findMany).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test("re-checks under the lock, and a survey restored or held in between is neither deleted nor queued", async () => {
      const tx = mockTransaction({ eligible: false });

      await expect(deleteSurvey(surveyId, { purgeCutoff: cutoff })).rejects.toThrow(ResourceNotFoundError);
      expect(tx.survey.findFirst).toHaveBeenCalledWith({
        where: { id: surveyId, ...getSurveyPurgeEligibleWhere(cutoff) },
        select: { id: true },
      });
      expect(enqueueSurveyDeletionCleanups).not.toHaveBeenCalled();
      expect(tx.survey.delete).not.toHaveBeenCalled();
      expect(drainDeletionCleanups).not.toHaveBeenCalled();
    });

    test("deletes a survey still eligible under the lock", async () => {
      const tx = mockTransaction();

      await expect(deleteSurvey(surveyId, { purgeCutoff: cutoff })).resolves.toEqual(mockDeletedSurveyLink);
      expect(tx.survey.delete).toHaveBeenCalled();
    });

    test("checks no eligibility for a manual delete", async () => {
      const tx = mockTransaction();

      await deleteSurvey(surveyId);

      expect(prisma.survey.findFirst).not.toHaveBeenCalled();
      expect(tx.survey.findFirst).not.toHaveBeenCalled();
    });
  });
});

describe("archiveSurvey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should archive an inProgress survey by pausing it, preserving publishOn", async () => {
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
      data: { archivedAt: expect.any(Date), status: "paused" },
      select: { id: true, status: true, archivedAt: true },
    });
  });

  test("should archive a paused survey without changing its status or publishOn", async () => {
    const findUniqueMock = vi.fn().mockResolvedValue({ id: surveyId, status: "paused", archivedAt: null });
    const updateMock = vi.fn().mockResolvedValue({ id: surveyId, status: "paused", archivedAt: new Date() });

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback({ survey: { findUnique: findUniqueMock, update: updateMock } } as never)
    );

    await archiveSurvey(surveyId);

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: surveyId },
      data: { archivedAt: expect.any(Date) },
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
