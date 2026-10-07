import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getSurvey } from "@/lib/survey/service";
import { validateInputs } from "@/lib/utils/validate";
import { deleteResponseFileUrls } from "@/modules/storage/lib/delete-response-files";
import { deleteSurveyUploadFilesBestEffort } from "@/modules/storage/service";
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
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@/modules/storage/lib/delete-response-files", () => ({
  deleteResponseFileUrls: vi.fn(),
}));

vi.mock("@/modules/storage/service", () => ({
  deleteSurveyUploadFilesBestEffort: vi.fn(),
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

  describe("storage cleanup", () => {
    const fileUploadElementId = "clq5n7p1q0000m7z0h5p6g3r7";
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
    const surveyWithoutFileUpload = { workspaceId, questions: [], blocks: [] } as unknown as TSurvey;

    // A current upload, keyed under this survey's folder, and a pre-#8044 upload with a flat key.
    const fileUrl = (name: string) =>
      `/storage/${workspaceId}/private/surveys/${surveyId}/elements/${fileUploadElementId}/${name}`;
    const flatFileUrl = (name: string) => `/storage/${workspaceId}/private/${name}`;
    const otherSurveyFileUrl = (name: string) =>
      `/storage/${workspaceId}/private/surveys/clq5n7p1q0000m7z0h5p6g3r9/elements/${fileUploadElementId}/${name}`;

    const mockTransaction = (tx: Record<string, unknown>) =>
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => callback(tx as never));

    const mockGuardedTransaction = (archivedAt: Date | null, deleteMock = vi.fn()) =>
      mockTransaction({
        $queryRaw: vi.fn().mockResolvedValue([]),
        survey: { findUnique: vi.fn().mockResolvedValue({ archivedAt }), delete: deleteMock },
        segment: { delete: vi.fn() },
      });

    beforeEach(() => {
      vi.mocked(getSurvey).mockResolvedValue(surveyWithFileUpload);
      vi.mocked(prisma.response.findMany).mockResolvedValue([
        {
          id: "response-1",
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
          data: { [fileUploadElementId]: [fileUrl("a.png"), flatFileUrl("b.pdf")], other: "not a file" },
        },
      ] as never);
      vi.mocked(deleteResponseFileUrls).mockResolvedValue(undefined);
      vi.mocked(deleteSurveyUploadFilesBestEffort).mockResolvedValue(undefined);
    });

    test("deletes the responses' uploaded files after the survey row is gone", async () => {
      const callOrder: string[] = [];
      vi.mocked(prisma.response.findMany).mockImplementation((async () => {
        callOrder.push("scan");
        return [
          {
            id: "response-1",
            createdAt: new Date(),
            data: { [fileUploadElementId]: [flatFileUrl("a.png")] },
          },
        ];
      }) as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        callOrder.push("transaction");
        return callback({
          survey: {
            delete: vi.fn(async () => {
              callOrder.push("delete");
              return mockDeletedSurveyLink;
            }),
          },
          segment: { delete: vi.fn() },
        } as never);
      });
      vi.mocked(deleteResponseFileUrls).mockImplementation(async () => {
        callOrder.push("files");
      });
      vi.mocked(deleteSurveyUploadFilesBestEffort).mockImplementation(async () => {
        callOrder.push("folder");
      });

      await deleteSurvey(surveyId);

      // The URLs live only in response.data, which the cascade takes with it, so the scan must come
      // first, and outside the transaction so it never holds the guard's row lock. Storage goes last so
      // no file is removed while its survey could still survive.
      expect(callOrder.slice(0, 3)).toEqual(["scan", "transaction", "delete"]);
      expect(new Set(callOrder.slice(3))).toEqual(new Set(["files", "folder"]));
      expect(deleteResponseFileUrls).toHaveBeenCalledWith([flatFileUrl("a.png")], workspaceId);
      expect(deleteSurveyUploadFilesBestEffort).toHaveBeenCalledWith({ workspaceId, surveyId });
    });

    test("deletes only flat keys one by one, leaving survey-filed keys to the folder sweep", async () => {
      vi.mocked(prisma.response.findMany).mockResolvedValue([
        {
          id: "response-1",
          createdAt: new Date("2026-06-01T00:00:00.000Z"),
          data: {
            [fileUploadElementId]: [fileUrl("a.png"), flatFileUrl("b.pdf"), otherSurveyFileUrl("c.png")],
            // Left by an upload element since removed from the survey: still filed under its folder.
            "removed-upload": [
              `/storage/${workspaceId}/private/surveys/${surveyId}/elements/removed-upload/d.png`,
            ],
          },
        },
      ] as never);
      mockTransaction({
        survey: { delete: vi.fn().mockResolvedValue(mockDeletedSurveyLink) },
        segment: { delete: vi.fn() },
      });

      await deleteSurvey(surveyId);

      // This survey's own uploads are swept with its folder, removed element included, so deleting them
      // one by one as well would double the storage calls; the other survey's upload is not this
      // survey's to delete at all.
      expect(deleteResponseFileUrls).toHaveBeenCalledTimes(1);
      expect(deleteResponseFileUrls).toHaveBeenCalledWith([flatFileUrl("b.pdf")], workspaceId);
      expect(deleteSurveyUploadFilesBestEffort).toHaveBeenCalledWith({ workspaceId, surveyId });
    });

    test("still sweeps the upload folder when no current element is a file upload", async () => {
      // An upload element removed from the survey leaves its files under the survey's folder, which the
      // sweep removes. The flat-key scan has no element id to match, so it is skipped rather than reading
      // every response for nothing.
      vi.mocked(getSurvey).mockResolvedValue(surveyWithoutFileUpload);
      mockTransaction({
        survey: { delete: vi.fn().mockResolvedValue(mockDeletedSurveyLink) },
        segment: { delete: vi.fn() },
      });

      await deleteSurvey(surveyId);

      expect(prisma.response.findMany).not.toHaveBeenCalled();
      expect(deleteResponseFileUrls).not.toHaveBeenCalled();
      expect(deleteSurveyUploadFilesBestEffort).toHaveBeenCalledWith({ workspaceId, surveyId });
    });

    test("reports the survey as deleted when storage cleanup fails", async () => {
      mockTransaction({
        survey: { delete: vi.fn().mockResolvedValue(mockDeletedSurveyLink) },
        segment: { delete: vi.fn() },
      });
      vi.mocked(deleteResponseFileUrls).mockRejectedValue(new Error("storage down"));

      // The row is already committed as deleted, so a storage failure must not turn into an error the
      // caller would retry against a survey that no longer exists.
      await expect(deleteSurvey(surveyId)).resolves.toEqual(mockDeletedSurveyLink);
      expect(logger.error).toHaveBeenCalled();
    });

    test("leaves every file alone when the delete itself fails", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Constraint failed", {
          code: "P2003",
          clientVersion: "4.0.0",
        })
      );

      await expect(deleteSurvey(surveyId)).rejects.toThrow(DatabaseError);
      expect(deleteResponseFileUrls).not.toHaveBeenCalled();
      expect(deleteSurveyUploadFilesBestEffort).not.toHaveBeenCalled();
    });

    test("deletes the files of a survey the archive purge removes", async () => {
      mockGuardedTransaction(
        new Date("2026-05-01T00:00:00.000Z"),
        vi.fn().mockResolvedValue(mockDeletedSurveyLink)
      );

      await deleteSurvey(surveyId, { requireArchivedBefore: cutoff });

      expect(deleteResponseFileUrls).toHaveBeenCalledWith([flatFileUrl("b.pdf")], workspaceId);
      expect(deleteSurveyUploadFilesBestEffort).toHaveBeenCalledWith({ workspaceId, surveyId });
    });

    test("touches no files when the purge finds the survey was restored", async () => {
      mockGuardedTransaction(null);

      await expect(deleteSurvey(surveyId, { requireArchivedBefore: cutoff })).rejects.toThrow(
        ResourceNotFoundError
      );
      expect(deleteResponseFileUrls).not.toHaveBeenCalled();
      expect(deleteSurveyUploadFilesBestEffort).not.toHaveBeenCalled();
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
