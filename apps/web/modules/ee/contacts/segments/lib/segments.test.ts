import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import {
  DatabaseError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import {
  TBaseFilters,
  TEvaluateSegmentUserData,
  TSegmentCreateInput,
  TSegmentUpdateInput,
  TSegmentWithSurveyRefs,
} from "@formbricks/types/segment";
import { getSurvey } from "@/lib/survey/service";
import { validateInputs } from "@/lib/utils/validate";
import { SegmentSurveysChangedError } from "./segment-errors";
import {
  ALL_SEGMENT_SURVEY_REFS,
  PrismaSegment,
  cloneSegment,
  compareValues,
  createSegment,
  deleteSegment,
  evaluateSegment,
  getExistingWorkspaceSurveyIds,
  getSegment,
  getSegments,
  getSegmentsByAttributeKey,
  getSegmentsByIds,
  getSurveyIdsTargetedThroughNesting,
  getSurveyWorkspaceIdMap,
  resetSegmentInSurvey,
  selectSegment,
  transformPrismaSegment,
  updateSegment,
} from "./segments";

/** The ids a batched survey lookup asks for (`where: { id: { in } }`). */
const idsIn = (args: unknown) => (args as { where: { id: { in: string[] } } }).where.id.in;

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    segment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      findFirst: vi.fn(),
    },
    survey: {
      update: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)), // Mock transaction to execute the callback
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  },
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(() => true), // Assume validation passes
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Helper data
const workspaceId = "workspace-id-mock";
const segmentId = "test-segment-id";
const surveyId = "test-survey-id";
const attributeKey = "email";

const mockSegmentPrisma = {
  id: segmentId,
  createdAt: new Date(),
  updatedAt: new Date(),
  title: "Test Segment",
  description: "This is a test segment",
  workspaceId,
  filters: [],
  isPrivate: false,
  surveys: [{ id: surveyId, name: "Test Survey", status: "inProgress" }],
};

const mockSegment: TSegmentWithSurveyRefs = {
  ...mockSegmentPrisma,
  surveys: [surveyId],
  activeSurveys: [{ id: surveyId, name: "Test Survey" }],
  inactiveSurveys: [],
};

const mockSegmentCreateInput = {
  workspaceId,
  title: "New Segment",
  isPrivate: false,
  filters: [],
} as unknown as TSegmentCreateInput;

const mockSurvey = {
  id: surveyId,
  workspaceId,
  name: "Test Survey",
  status: "inProgress",
};

describe("Segment Service Tests", () => {
  describe("transformPrismaSegment", () => {
    test("should transform Prisma segment to TSegment", () => {
      const transformed = transformPrismaSegment(mockSegmentPrisma as unknown as PrismaSegment);
      expect(transformed).toEqual(mockSegment);
    });
  });

  describe("getSegment", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    test("should return a segment successfully", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);
      const segment = await getSegment(segmentId);
      expect(segment).toEqual(mockSegment);
      expect(prisma.segment.findUnique).toHaveBeenCalledWith({
        where: { id: segmentId },
        select: selectSegment,
      });
      expect(validateInputs).toHaveBeenCalledWith([segmentId, expect.any(Object)]);
    });

    test("should throw ResourceNotFoundError if segment not found", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(null);
      await expect(getSegment(segmentId)).rejects.toThrow(ResourceNotFoundError);
      expect(prisma.segment.findUnique).toHaveBeenCalledWith({
        where: { id: segmentId },
        select: selectSegment,
      });
    });

    test("should throw DatabaseError on Prisma error", async () => {
      vi.mocked(prisma.segment.findUnique).mockRejectedValue(new Error("DB error"));
      await expect(getSegment(segmentId)).rejects.toThrow(Error);
      expect(prisma.segment.findUnique).toHaveBeenCalledWith({
        where: { id: segmentId },
        select: selectSegment,
      });
    });
  });

  describe("getSegments", () => {
    test("should return a list of segments", async () => {
      vi.mocked(prisma.segment.findMany).mockResolvedValue([mockSegmentPrisma]);
      const segments = await getSegments("workspace-id-mock", ALL_SEGMENT_SURVEY_REFS);
      expect(segments).toEqual([mockSegment]);
      expect(prisma.segment.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "workspace-id-mock" },
        select: selectSegment,
      });
      expect(validateInputs).toHaveBeenCalledWith(["workspace-id-mock", expect.any(Object)]);
    });

    // ENG-3282: segments reach the browser on the survey pages, so their survey references go through the
    // viewer's visibility clause in SQL.
    test("reads each segment's survey references through the visibility clause", async () => {
      vi.mocked(prisma.segment.findMany).mockResolvedValue([]);
      const visibleSurveyWhere = { OR: [{ visibility: "workspace" as const }, { ownerId: "user-1" }] };

      await getSegments("workspace-id-mock", visibleSurveyWhere);

      expect(prisma.segment.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "workspace-id-mock" },
        select: { ...selectSegment, surveys: { ...selectSegment.surveys, where: visibleSurveyWhere } },
      });
    });

    test("should return an empty array if no segments found", async () => {
      vi.mocked(prisma.segment.findMany).mockResolvedValue([]);
      const segments = await getSegments("workspace-id-mock", ALL_SEGMENT_SURVEY_REFS);
      expect(segments).toEqual([]);
    });

    test("should throw DatabaseError on Prisma error", async () => {
      vi.mocked(prisma.segment.findMany).mockRejectedValue(new Error("DB error"));
      await expect(getSegments("workspace-id-mock", ALL_SEGMENT_SURVEY_REFS)).rejects.toThrow(Error);
    });
  });

  describe("getSegmentsByIds", () => {
    const workspaceId = "workspace-1";

    test("reads only the filters of the given ids in the workspace, in one query", async () => {
      const filters = [{ id: "filter-1" }] as unknown as TBaseFilters;
      vi.mocked(prisma.segment.findMany).mockResolvedValue([
        { id: "segment-1", isPrivate: true, filters: [] },
        { id: "segment-2", isPrivate: false, filters },
      ] as unknown as Awaited<ReturnType<typeof prisma.segment.findMany>>);

      await expect(getSegmentsByIds(["segment-1", "segment-2"], workspaceId)).resolves.toEqual([
        { id: "segment-1", isPrivate: true, filters: [] },
        { id: "segment-2", isPrivate: false, filters },
      ]);
      expect(prisma.segment.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.segment.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["segment-1", "segment-2"] }, workspaceId },
        select: { id: true, isPrivate: true, filters: true },
      });
    });

    test("maps a Prisma failure to DatabaseError", async () => {
      vi.mocked(prisma.segment.findMany).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("boom", { code: "P1", clientVersion: "5" })
      );

      await expect(getSegmentsByIds(["segment-1"], workspaceId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getSurveyWorkspaceIdMap", () => {
    test("builds an id→workspaceId map, selecting only id and workspaceId", async () => {
      vi.mocked(prisma.survey.findMany).mockResolvedValue([
        { id: "survey1", workspaceId: "ws-a" },
        { id: "survey2", workspaceId: "ws-b" },
      ] as Awaited<ReturnType<typeof prisma.survey.findMany>>);

      const result = await getSurveyWorkspaceIdMap(["survey1", "survey2"]);

      expect(result).toEqual(
        new Map([
          ["survey1", "ws-a"],
          ["survey2", "ws-b"],
        ])
      );
      expect(prisma.survey.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["survey1", "survey2"] } },
        select: { id: true, workspaceId: true },
      });
    });

    test("returns an empty map when no surveys match", async () => {
      vi.mocked(prisma.survey.findMany, { partial: true, deep: true }).mockResolvedValue([]);

      const result = await getSurveyWorkspaceIdMap(["missing"]);

      expect(result.size).toBe(0);
    });

    test("short-circuits to an empty map without querying when no ids are given", async () => {
      const result = await getSurveyWorkspaceIdMap([]);

      expect(result.size).toBe(0);
      expect(prisma.survey.findMany).not.toHaveBeenCalled();
    });

    test("deduplicates ids before querying", async () => {
      vi.mocked(prisma.survey.findMany, { partial: true, deep: true }).mockResolvedValue([
        { id: "survey1", workspaceId: "ws-a" },
      ]);

      const result = await getSurveyWorkspaceIdMap(["survey1", "survey1", "survey1"]);

      expect(result).toEqual(new Map([["survey1", "ws-a"]]));
      expect(prisma.survey.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.survey.findMany).toHaveBeenCalledWith({
        where: { id: { in: ["survey1"] } },
        select: { id: true, workspaceId: true },
      });
    });

    test("splits an oversized id list into bounded batches and merges the results", async () => {
      const surveyIds = Array.from({ length: 450 }, (_, index) => `survey_${index}`);
      vi.mocked(prisma.survey.findMany, { partial: true, deep: true }).mockImplementation(async (args) =>
        idsIn(args).map((id: string) => ({ id, workspaceId: "ws-a" }))
      );

      const result = await getSurveyWorkspaceIdMap(surveyIds);

      // 450 ids at a batch size of 200 -> 200 / 200 / 50, every id still present in the merged map.
      const batchSizes = vi.mocked(prisma.survey.findMany).mock.calls.map(([args]) => idsIn(args).length);
      expect(batchSizes).toEqual([200, 200, 50]);
      expect(result.size).toBe(450);
      expect(result.get("survey_0")).toBe("ws-a");
      expect(result.get("survey_449")).toBe("ws-a");
    });
  });

  describe("getExistingWorkspaceSurveyIds", () => {
    test("returns only the referenced ids that belong to the workspace, scoped by workspaceId", async () => {
      vi.mocked(prisma.survey.findMany, { partial: true, deep: true }).mockResolvedValue([
        { id: "survey_known" },
      ]);

      const result = await getExistingWorkspaceSurveyIds(
        "ws_1",
        ["survey_known", "survey_foreign"],
        ALL_SEGMENT_SURVEY_REFS
      );

      expect(result).toEqual(new Set(["survey_known"]));
      expect(prisma.survey.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "ws_1", id: { in: ["survey_known", "survey_foreign"] } },
        select: { id: true },
      });
    });

    test("narrows the lookup to the caller's visible surveys when given a clause (ENG-3282)", async () => {
      vi.mocked(prisma.survey.findMany, { partial: true, deep: true }).mockResolvedValue([]);
      const visible: Prisma.SurveyWhereInput = { OR: [{ visibility: "workspace" }, { ownerId: "user_1" }] };

      await getExistingWorkspaceSurveyIds("ws_1", ["survey_restricted"], visible);

      expect(prisma.survey.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "ws_1", id: { in: ["survey_restricted"] }, AND: [visible] },
        select: { id: true },
      });
    });

    test("short-circuits to an empty set without querying when no ids are given", async () => {
      const result = await getExistingWorkspaceSurveyIds("ws_1", [], ALL_SEGMENT_SURVEY_REFS);

      expect(result.size).toBe(0);
      expect(prisma.survey.findMany).not.toHaveBeenCalled();
    });

    test("deduplicates ids before querying", async () => {
      vi.mocked(prisma.survey.findMany, { partial: true, deep: true }).mockResolvedValue([{ id: "survey1" }]);

      const result = await getExistingWorkspaceSurveyIds(
        "ws_1",
        ["survey1", "survey1", "survey1"],
        ALL_SEGMENT_SURVEY_REFS
      );

      expect(result).toEqual(new Set(["survey1"]));
      expect(prisma.survey.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.survey.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "ws_1", id: { in: ["survey1"] } },
        select: { id: true },
      });
    });

    test("splits an oversized id list into bounded batches and still returns only the found subset", async () => {
      const surveyIds = Array.from({ length: 450 }, (_, index) => `survey_${index}`);
      // survey_449 (last batch) is foreign/unknown — everything else belongs to the workspace.
      vi.mocked(prisma.survey.findMany, { partial: true, deep: true }).mockImplementation(async (args) =>
        idsIn(args)
          .filter((id: string) => id !== "survey_449")
          .map((id: string) => ({ id }))
      );

      const result = await getExistingWorkspaceSurveyIds("ws_1", surveyIds, ALL_SEGMENT_SURVEY_REFS);

      // 450 ids at a batch size of 200 -> 200 / 200 / 50, each query scoped to the workspace.
      const batchSizes = vi.mocked(prisma.survey.findMany).mock.calls.map(([args]) => idsIn(args).length);
      expect(batchSizes).toEqual([200, 200, 50]);
      for (const [args] of vi.mocked(prisma.survey.findMany).mock.calls) {
        expect(args).toHaveProperty("where.workspaceId", "ws_1");
      }
      expect(result.size).toBe(449);
      expect(result.has("survey_0")).toBe(true);
      expect(result.has("survey_449")).toBe(false);
    });
  });

  describe("createSegment", () => {
    test("should create a segment without surveyId", async () => {
      vi.mocked(prisma.segment.create).mockResolvedValue(mockSegmentPrisma);
      const segment = await createSegment(mockSegmentCreateInput);
      expect(segment).toEqual(mockSegment);
      expect(prisma.segment.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          title: mockSegmentCreateInput.title,
          description: undefined,
          isPrivate: false,
          filters: [],
        },
        select: selectSegment,
      });
      expect(validateInputs).toHaveBeenCalledWith([mockSegmentCreateInput, expect.any(Object)]);
    });

    test("should create a segment with surveyId", async () => {
      const inputWithSurvey: TSegmentCreateInput = { ...mockSegmentCreateInput, surveyId };
      vi.mocked(prisma.segment.create).mockResolvedValue(mockSegmentPrisma);
      const segment = await createSegment(inputWithSurvey);
      expect(segment).toEqual(mockSegment);
      expect(prisma.segment.create).toHaveBeenCalledWith({
        data: {
          workspaceId,
          title: inputWithSurvey.title,
          description: undefined,
          isPrivate: false,
          filters: [],
          surveys: { connect: { id: surveyId } },
        },
        select: selectSegment,
      });
    });

    test("should throw DatabaseError on Prisma error", async () => {
      vi.mocked(prisma.segment.create).mockRejectedValue(new Error("DB error"));
      await expect(createSegment(mockSegmentCreateInput)).rejects.toThrow(Error);
    });

    test("should upsert a private segment with surveyId", async () => {
      // A private segment is titled with the id of its survey (ZSegmentCreateInput).
      const privateInputWithSurvey: TSegmentCreateInput = {
        ...mockSegmentCreateInput,
        title: surveyId,
        isPrivate: true,
        surveyId,
      };
      const privateSegmentPrisma = { ...mockSegmentPrisma, isPrivate: true };
      vi.mocked(prisma.segment.upsert).mockResolvedValue(privateSegmentPrisma);
      const segment = await createSegment(privateInputWithSurvey);
      expect(segment).toEqual({ ...mockSegment, isPrivate: true });
      expect(prisma.segment.upsert).toHaveBeenCalledWith({
        where: {
          workspaceId_title: {
            workspaceId,
            title: privateInputWithSurvey.title,
          },
          isPrivate: true,
          surveys: { every: { id: surveyId } },
        },
        create: {
          workspaceId,
          title: privateInputWithSurvey.title,
          description: undefined,
          isPrivate: true,
          filters: [],
          surveys: { connect: { id: surveyId } },
        },
        update: {
          description: undefined,
          filters: [],
          surveys: { connect: { id: surveyId } },
        },
        select: selectSegment,
      });
      expect(prisma.segment.create).not.toHaveBeenCalled();
    });

    // ENG-6956: the private key is chosen on the server, so even an input that slipped past the schema
    // (validateInputs is mocked here) cannot point the upsert at another survey's segment.
    test("should key a private segment by its survey id, not by the client's title", async () => {
      vi.mocked(prisma.segment.upsert).mockResolvedValue({ ...mockSegmentPrisma, isPrivate: true });

      await createSegment({ ...mockSegmentCreateInput, title: "other-survey-id", isPrivate: true, surveyId });

      expect(prisma.segment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            workspaceId_title: { workspaceId, title: surveyId },
            isPrivate: true,
            surveys: { every: { id: surveyId } },
          },
          create: expect.objectContaining({ title: surveyId }),
        })
      );
    });

    test("should retry a private upsert once when a concurrent first save created the segment", async () => {
      const clash = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      });
      vi.mocked(prisma.segment.upsert)
        .mockRejectedValueOnce(clash)
        .mockResolvedValueOnce({ ...mockSegmentPrisma, isPrivate: true });

      const segment = await createSegment({
        ...mockSegmentCreateInput,
        title: surveyId,
        isPrivate: true,
        surveyId,
      });

      expect(segment.id).toBe(segmentId);
      expect(prisma.segment.upsert).toHaveBeenCalledTimes(2);
    });

    test("should refuse a private upsert whose title a shared segment holds (the clash persists)", async () => {
      const clash = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      });
      vi.mocked(prisma.segment.upsert).mockRejectedValueOnce(clash).mockRejectedValueOnce(clash);

      await expect(
        createSegment({ ...mockSegmentCreateInput, title: surveyId, isPrivate: true, surveyId })
      ).rejects.toBeInstanceOf(InvalidInputError);
      expect(prisma.segment.upsert).toHaveBeenCalledTimes(2);
    });

    test("should not retry a private upsert on any other Prisma error", async () => {
      vi.mocked(prisma.segment.upsert).mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
          code: "P2003",
          clientVersion: "test",
        })
      );

      await expect(
        createSegment({ ...mockSegmentCreateInput, title: surveyId, isPrivate: true, surveyId })
      ).rejects.toBeInstanceOf(DatabaseError);
      expect(prisma.segment.upsert).toHaveBeenCalledTimes(1);
    });

    test("should keep any other Prisma error a DatabaseError", async () => {
      vi.mocked(prisma.segment.create).mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
          code: "P2003",
          clientVersion: "test",
        })
      );

      await expect(createSegment({ ...mockSegmentCreateInput, surveyId })).rejects.toBeInstanceOf(
        DatabaseError
      );
    });

    // ENG-6956: the ticket's overwrite needs a shared segment (or any title a caller picks) that is
    // really a survey's id. The private upsert is covered against real Postgres in
    // integration/segment-private-title.integration.test.ts.
    test("should refuse a shared segment titled with the id of a survey in the workspace", async () => {
      vi.mocked(prisma.survey.findFirst, { partial: true, deep: true }).mockResolvedValueOnce({
        id: "other-survey-id",
      });

      await expect(
        createSegment({ ...mockSegmentCreateInput, title: "other-survey-id", surveyId })
      ).rejects.toThrow(InvalidInputError);

      expect(prisma.survey.findFirst).toHaveBeenCalledWith({
        where: { id: "other-survey-id", workspaceId },
        select: { id: true },
      });
      expect(prisma.segment.create).not.toHaveBeenCalled();
    });
  });

  describe("cloneSegment", () => {
    const clonedSegmentId = "cloned-segment-id";
    const clonedSegmentPrisma = {
      ...mockSegmentPrisma,
      id: clonedSegmentId,
      title: "Copy of Test Segment (1)",
    };
    const clonedSegment = {
      ...mockSegment,
      id: clonedSegmentId,
      title: "Copy of Test Segment (1)",
      activeSurveys: [{ id: surveyId, name: "Test Survey" }],
      inactiveSurveys: [],
    };

    beforeEach(() => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);
      vi.mocked(prisma.segment.findMany).mockResolvedValue([mockSegmentPrisma]);
      vi.mocked(prisma.segment.create).mockResolvedValue(clonedSegmentPrisma);
    });

    test("should clone a segment successfully with suffix (1)", async () => {
      const result = await cloneSegment(segmentId, surveyId);
      expect(result).toEqual(clonedSegment);
      expect(prisma.segment.findUnique).toHaveBeenCalledWith({
        where: { id: segmentId },
        select: selectSegment,
      });
      expect(prisma.segment.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "workspace-id-mock" },
        select: selectSegment,
      });
      expect(prisma.segment.create).toHaveBeenCalledWith({
        data: {
          title: "Copy of Test Segment (1)",
          description: mockSegment.description,
          isPrivate: mockSegment.isPrivate,
          workspaceId: mockSegment.workspaceId,
          filters: mockSegment.filters,
          surveys: { connect: { id: surveyId } },
        },
        select: selectSegment,
      });
    });

    test("should clone a segment successfully with incremented suffix", async () => {
      const existingCopyPrisma = { ...mockSegmentPrisma, id: "copy-1", title: "Copy of Test Segment (1)" };
      const clonedSegmentPrisma2 = { ...clonedSegmentPrisma, title: "Copy of Test Segment (2)" };
      const clonedSegment2 = {
        ...clonedSegment,
        title: "Copy of Test Segment (2)",
        activeSurveys: [{ id: surveyId, name: "Test Survey" }],
        inactiveSurveys: [],
      };

      vi.mocked(prisma.segment.findMany).mockResolvedValue([mockSegmentPrisma, existingCopyPrisma]);
      vi.mocked(prisma.segment.create).mockResolvedValue(clonedSegmentPrisma2);

      const result = await cloneSegment(segmentId, surveyId);
      expect(result).toEqual(clonedSegment2);
      expect(prisma.segment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ title: "Copy of Test Segment (2)" }),
        })
      );
    });

    test("should throw ResourceNotFoundError if original segment not found", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(null);
      await expect(cloneSegment(segmentId, surveyId)).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw ValidationError if filters are invalid", async () => {
      const invalidFilterSegment = { ...mockSegmentPrisma, filters: "invalid" };
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(invalidFilterSegment);
      await expect(cloneSegment(segmentId, surveyId)).rejects.toThrow(ValidationError);
    });

    test("should throw DatabaseError on Prisma create error", async () => {
      vi.mocked(prisma.segment.create).mockRejectedValue(new Error("DB create error"));
      await expect(cloneSegment(segmentId, surveyId)).rejects.toThrow(Error);
    });
  });

  describe("deleteSegment", () => {
    const segmentToDeletePrisma = { ...mockSegmentPrisma, surveys: [] };
    const segmentToDelete = { ...mockSegment, surveys: [], activeSurveys: [], inactiveSurveys: [] };

    beforeEach(() => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(segmentToDeletePrisma);
      vi.mocked(prisma.$executeRaw).mockResolvedValue(1);
    });

    test("deletes an unused segment in one guarded statement, scoped to its workspace", async () => {
      await expect(deleteSegment(segmentId)).resolves.toEqual(segmentToDelete);

      expect(prisma.$executeRaw).toHaveBeenCalledOnce();
      expect(vi.mocked(prisma.$executeRaw).mock.calls[0].slice(1)).toEqual(
        expect.arrayContaining([segmentId, workspaceId])
      );
      expect(prisma.segment.delete).not.toHaveBeenCalled();
    });

    test("should throw ResourceNotFoundError if segment not found", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(null);
      await expect(deleteSegment(segmentId)).rejects.toThrow(ResourceNotFoundError);
    });

    test("refuses a segment linked to surveys without trying the delete", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);
      await expect(deleteSegment(segmentId)).rejects.toThrow(
        new OperationNotAllowedError("Cannot delete a segment that is associated with a survey")
      );
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    test("names nesting when the guarded delete matched nothing and no survey links it (ENG-7269)", async () => {
      vi.mocked(prisma.$executeRaw).mockResolvedValue(0);
      vi.mocked(prisma.segment.findUnique)
        .mockResolvedValueOnce(segmentToDeletePrisma)
        .mockResolvedValueOnce({ _count: { surveys: 0 } } as never);

      await expect(deleteSegment(segmentId)).rejects.toThrow(
        new OperationNotAllowedError("Cannot delete a segment that another segment's filters use")
      );
    });

    test("names a survey connected since the read (ENG-7269)", async () => {
      vi.mocked(prisma.$executeRaw).mockResolvedValue(0);
      vi.mocked(prisma.segment.findUnique)
        .mockResolvedValueOnce(segmentToDeletePrisma)
        .mockResolvedValueOnce({ _count: { surveys: 1 } } as never);

      await expect(deleteSegment(segmentId)).rejects.toThrow(
        new OperationNotAllowedError("Cannot delete a segment that is associated with a survey")
      );
    });

    test("answers a segment deleted meanwhile with ResourceNotFoundError (ENG-7269)", async () => {
      vi.mocked(prisma.$executeRaw).mockResolvedValue(0);
      vi.mocked(prisma.segment.findUnique)
        .mockResolvedValueOnce(segmentToDeletePrisma)
        .mockResolvedValueOnce(null);

      await expect(deleteSegment(segmentId)).rejects.toThrow(ResourceNotFoundError);
    });

    test("maps a Prisma error to DatabaseError", async () => {
      vi.mocked(prisma.$executeRaw).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("boom", { code: "P2010", clientVersion: "test" })
      );
      await expect(deleteSegment(segmentId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("getSurveyIdsTargetedThroughNesting", () => {
    test("returns the surveys the nesting query finds, scoped to the segment's workspace (ENG-7269)", async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: "survey-a" }, { id: "survey-b" }]);

      await expect(getSurveyIdsTargetedThroughNesting(workspaceId, segmentId)).resolves.toEqual([
        "survey-a",
        "survey-b",
      ]);
      const [, ...params] = vi.mocked(prisma.$queryRaw).mock.calls[0];
      expect(params).toEqual(expect.arrayContaining([workspaceId, segmentId]));
    });

    test("wraps a Prisma error in a DatabaseError", async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("boom", { code: "P2010", clientVersion: "test" })
      );

      await expect(getSurveyIdsTargetedThroughNesting(workspaceId, segmentId)).rejects.toThrow(DatabaseError);
    });
  });

  describe("resetSegmentInSurvey", () => {
    const privateSegmentId = "private-segment-id";
    const privateSegmentPrisma = {
      ...mockSegmentPrisma,
      id: privateSegmentId,
      title: surveyId,
      isPrivate: true,
      filters: [], // Simplified filters to avoid type issues
      surveys: [{ id: surveyId, name: "Test Survey", status: "inProgress" }],
    };
    const resetPrivateSegmentPrisma = { ...privateSegmentPrisma, filters: [] };
    const resetPrivateSegment = {
      ...mockSegment,
      id: privateSegmentId,
      title: surveyId,
      isPrivate: true,
      filters: [],
      activeSurveys: [{ id: surveyId, name: "Test Survey" }],
      inactiveSurveys: [],
    };

    beforeEach(() => {
      vi.mocked(getSurvey).mockResolvedValue(mockSurvey as Awaited<ReturnType<typeof getSurvey>>);
      vi.mocked(prisma.segment.findFirst).mockResolvedValue(privateSegmentPrisma);
      vi.mocked(prisma.survey.update, { partial: true, deep: true }).mockResolvedValue({});
      vi.mocked(prisma.segment.update, { partial: true, deep: true }).mockResolvedValue(
        resetPrivateSegmentPrisma
      );
      vi.mocked(prisma.segment.create, { partial: true, deep: true }).mockResolvedValue(
        resetPrivateSegmentPrisma
      );
    });

    test("refuses resetting a private segment other surveys also use, without writing (ENG-7269)", async () => {
      vi.mocked(prisma.segment.findFirst).mockResolvedValue({
        ...privateSegmentPrisma,
        surveys: [
          ...privateSegmentPrisma.surveys,
          { id: "other-survey", name: "Other", status: "inProgress" },
        ],
      } as never);

      await expect(resetSegmentInSurvey(surveyId)).rejects.toThrow(
        "This survey's targeting segment is also used by other surveys, so it can't be reset here."
      );
      expect(prisma.survey.update).not.toHaveBeenCalled();
      expect(prisma.segment.update).not.toHaveBeenCalled();
    });

    test("refuses emptying a private segment another segment nests (ENG-7269)", async () => {
      vi.mocked(prisma.segment.findFirst).mockResolvedValue({
        ...privateSegmentPrisma,
        filters: [{ id: "f1" }],
      });
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ nested: true }]);

      await expect(resetSegmentInSurvey(surveyId)).rejects.toThrow(InvalidInputError);
      expect(prisma.segment.update).not.toHaveBeenCalled();
    });

    test("resets a nested private segment that is already empty without the nesting lookup", async () => {
      await resetSegmentInSurvey(surveyId);

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    test("should reset filters of existing private segment", async () => {
      const result = await resetSegmentInSurvey(surveyId);

      expect(result).toEqual(resetPrivateSegment);
      expect(getSurvey).toHaveBeenCalledWith(surveyId);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.segment.findFirst).toHaveBeenCalledWith({
        where: { workspaceId, title: surveyId, isPrivate: true },
        select: selectSegment,
      });
      expect(prisma.survey.update).toHaveBeenCalledWith({
        where: { id: surveyId },
        data: { segment: { connect: { id: privateSegmentId } } },
      });
      expect(prisma.segment.update).toHaveBeenCalledWith({
        where: { id: privateSegmentId, surveys: { every: { id: surveyId } } },
        data: { filters: [] },
        select: selectSegment,
      });
      expect(prisma.segment.create).not.toHaveBeenCalled();
    });

    test("should create a new private segment if none exists", async () => {
      vi.mocked(prisma.segment.findFirst).mockResolvedValue(null);
      const result = await resetSegmentInSurvey(surveyId);

      expect(result).toEqual(resetPrivateSegment);
      expect(getSurvey).toHaveBeenCalledWith(surveyId);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.segment.findFirst).toHaveBeenCalled();
      expect(prisma.survey.update).not.toHaveBeenCalled();
      expect(prisma.segment.update).not.toHaveBeenCalled();
      expect(prisma.segment.create).toHaveBeenCalledWith({
        data: {
          title: surveyId,
          isPrivate: true,
          filters: [],
          surveys: { connect: { id: surveyId } },
          workspaceId,
        },
        select: selectSegment,
      });
    });

    test("should throw ResourceNotFoundError if survey not found", async () => {
      vi.mocked(getSurvey).mockResolvedValue(null);
      await expect(resetSegmentInSurvey(surveyId)).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw DatabaseError on transaction error", async () => {
      vi.mocked(prisma.$transaction).mockRejectedValue(new Error("DB transaction error"));
      await expect(resetSegmentInSurvey(surveyId)).rejects.toThrow(Error);
    });
  });

  describe("updateSegment", () => {
    const updatedSegmentPrisma = { ...mockSegmentPrisma, title: "Updated Segment" };
    const updatedSegment = {
      ...mockSegment,
      title: "Updated Segment",
      activeSurveys: [{ id: surveyId, name: "Test Survey" }],
      inactiveSurveys: [],
    };
    const updateData: TSegmentUpdateInput = { title: "Updated Segment" };

    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(prisma.segment.update).mockResolvedValue(updatedSegmentPrisma);
    });

    test("should update a segment successfully", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);

      const result = await updateSegment(segmentId, updateData);

      expect(result).toEqual(updatedSegment);
      expect(prisma.segment.findUnique).toHaveBeenCalledWith({
        where: { id: segmentId },
        select: selectSegment,
      });
      expect(prisma.segment.update).toHaveBeenCalledWith({
        where: { id: segmentId },
        data: { ...updateData, surveys: undefined },
        select: selectSegment,
      });
      expect(validateInputs).toHaveBeenCalledWith(
        [segmentId, expect.any(Object)],
        [updateData, expect.any(Object)]
      );
    });

    test("guards the write on the surveys the caller was authorized to target (ENG-7269)", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);

      await updateSegment(segmentId, updateData, { connectedSurveyIds: [surveyId, surveyId] });

      expect(prisma.segment.update).toHaveBeenCalledWith({
        where: { id: segmentId, surveys: { every: { id: { in: [surveyId] } } } },
        data: { ...updateData, surveys: undefined },
        select: selectSegment,
      });
    });

    test("guards a filter change on the filters it was checked against (ENG-7269)", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);
      const expectedFilters = [{ id: "stored" }] as unknown as TBaseFilters;

      await updateSegment(segmentId, updateData, { connectedSurveyIds: [surveyId], expectedFilters });

      expect(prisma.segment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: segmentId,
            filters: { equals: expectedFilters },
            surveys: { every: { id: { in: [surveyId] } } },
          },
        })
      );
    });

    test("answers a changed connected set with SegmentSurveysChangedError (ENG-7269)", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);
      vi.mocked(prisma.segment.update).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("No record found", {
          code: "P2025",
          clientVersion: "test",
        })
      );

      await expect(
        updateSegment(segmentId, updateData, { connectedSurveyIds: [surveyId] })
      ).rejects.toBeInstanceOf(SegmentSurveysChangedError);

      expect(prisma.segment.findUnique).toHaveBeenLastCalledWith({
        where: { id: segmentId },
        select: { id: true },
      });
    });

    test("answers a segment deleted under a guarded write with ResourceNotFoundError (ENG-7269)", async () => {
      vi.mocked(prisma.segment.findUnique)
        .mockResolvedValueOnce(mockSegmentPrisma)
        .mockResolvedValueOnce(null);
      vi.mocked(prisma.segment.update).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("No record found", {
          code: "P2025",
          clientVersion: "test",
        })
      );

      await expect(updateSegment(segmentId, updateData, { connectedSurveyIds: [surveyId] })).rejects.toThrow(
        ResourceNotFoundError
      );
    });

    test("refuses making a shared segment private (ENG-7269)", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);

      await expect(updateSegment(segmentId, { isPrivate: true })).rejects.toThrow(
        new InvalidInputError("A shared segment can't be made private")
      );
      expect(prisma.segment.update).not.toHaveBeenCalled();
    });

    test("refuses connecting another survey to a private segment (ENG-7269)", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue({
        ...mockSegmentPrisma,
        title: surveyId,
        isPrivate: true,
      });

      await expect(updateSegment(segmentId, { surveys: [surveyId, "other-survey-id"] })).rejects.toThrow(
        new InvalidInputError("A private segment targets only its own survey")
      );
      expect(prisma.segment.update).not.toHaveBeenCalled();
    });

    test("lets a private segment connect surveys as it becomes shared (ENG-7269)", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue({
        ...mockSegmentPrisma,
        title: surveyId,
        isPrivate: true,
      });
      vi.mocked(prisma.survey.findFirst).mockResolvedValue(null);

      await updateSegment(segmentId, {
        title: "Shared",
        isPrivate: false,
        surveys: [surveyId, "other-survey-id"],
      });

      expect(prisma.segment.update).toHaveBeenCalledOnce();
    });

    test("should refuse renaming a segment to the id of a survey in its workspace (ENG-6956)", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);
      vi.mocked(prisma.survey.findFirst, { partial: true, deep: true }).mockResolvedValueOnce({
        id: "other-survey-id",
      });

      await expect(updateSegment(segmentId, { title: "other-survey-id" })).rejects.toThrow(InvalidInputError);

      expect(prisma.survey.findFirst).toHaveBeenCalledWith({
        where: { id: "other-survey-id", workspaceId },
        select: { id: true },
      });
      expect(prisma.segment.update).not.toHaveBeenCalled();
    });

    test("should not look up a survey when a shared segment keeps its title", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);

      const result = await updateSegment(segmentId, { title: mockSegmentPrisma.title });

      expect(result).toEqual(updatedSegment);
      expect(prisma.survey.findFirst).not.toHaveBeenCalled();
      expect(prisma.segment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ title: mockSegmentPrisma.title }) })
      );
    });

    test("should check the kept title when a private segment turns shared (ENG-6956)", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue({
        ...mockSegmentPrisma,
        title: surveyId,
        isPrivate: true,
      });
      vi.mocked(prisma.survey.findFirst, { partial: true, deep: true }).mockResolvedValueOnce({
        id: surveyId,
      });

      await expect(updateSegment(segmentId, { isPrivate: false })).rejects.toBeInstanceOf(InvalidInputError);

      expect(prisma.survey.findFirst).toHaveBeenCalledWith({
        where: { id: surveyId, workspaceId },
        select: { id: true },
      });
      expect(prisma.segment.update).not.toHaveBeenCalled();
    });

    test("should refuse renaming a segment that stays private (ENG-6956)", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue({
        ...mockSegmentPrisma,
        title: surveyId,
        isPrivate: true,
      });

      await expect(updateSegment(segmentId, { title: "Renamed" })).rejects.toThrow(
        new InvalidInputError("A private segment keeps the id of its survey as title")
      );
      await expect(updateSegment(segmentId, { title: "Renamed", isPrivate: true })).rejects.toThrow(
        new InvalidInputError("A private segment keeps the id of its survey as title")
      );

      expect(prisma.segment.update).not.toHaveBeenCalled();
    });

    // A guard test: that the conversion is saved is shown against real Postgres in
    // integration/segment-private-title.integration.test.ts.
    test("should not refuse a rename when a private segment turns shared (ENG-6956)", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue({
        ...mockSegmentPrisma,
        title: surveyId,
        isPrivate: true,
      });
      vi.mocked(prisma.survey.findFirst).mockResolvedValueOnce(null);

      await expect(
        updateSegment(segmentId, { title: "Loyal users", isPrivate: false })
      ).resolves.toBeDefined();
    });

    test("should update segment with survey connections", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);

      const newSurveyId = "new-survey-id";
      const updateDataWithSurveys: TSegmentUpdateInput = { ...updateData, surveys: [newSurveyId] };
      const updatedSegmentPrismaWithSurvey = {
        ...updatedSegmentPrisma,
        surveys: [{ id: newSurveyId, name: "New Survey", status: "draft" }],
      };
      const updatedSegmentWithSurvey = {
        ...updatedSegment,
        surveys: [newSurveyId],
        activeSurveys: [],
        inactiveSurveys: [{ id: newSurveyId, name: "New Survey" }],
      };

      vi.mocked(prisma.segment.update).mockResolvedValue(updatedSegmentPrismaWithSurvey);

      const result = await updateSegment(segmentId, updateDataWithSurveys);

      expect(result).toEqual(updatedSegmentWithSurvey);
      expect(prisma.segment.findUnique).toHaveBeenCalledWith({
        where: { id: segmentId },
        select: selectSegment,
      });
      expect(prisma.segment.update).toHaveBeenCalledWith({
        where: { id: segmentId },
        data: {
          ...updateData,
          surveys: { connect: [{ id: newSurveyId }] },
        },
        select: selectSegment,
      });
    });

    test("should throw ResourceNotFoundError if segment not found", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(null);

      await expect(updateSegment(segmentId, updateData)).rejects.toThrow(ResourceNotFoundError);

      expect(prisma.segment.findUnique).toHaveBeenCalledWith({
        where: { id: segmentId },
        select: selectSegment,
      });
      expect(prisma.segment.update).not.toHaveBeenCalled();
    });

    test("should throw DatabaseError on Prisma update error", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);
      vi.mocked(prisma.segment.update).mockRejectedValue(new Error("DB update error"));

      await expect(updateSegment(segmentId, updateData)).rejects.toThrow(Error);

      expect(prisma.segment.findUnique).toHaveBeenCalledWith({
        where: { id: segmentId },
        select: selectSegment,
      });
      expect(prisma.segment.update).toHaveBeenCalled();
    });

    test("should refuse renaming onto a title another segment holds (ENG-6956)", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);
      vi.mocked(prisma.segment.update).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        })
      );

      const update = updateSegment(segmentId, updateData);
      await expect(update).rejects.toBeInstanceOf(InvalidInputError);
      await expect(update).rejects.toThrow("A segment with this title already exists");
    });
  });

  describe("getSegmentsByAttributeKey", () => {
    const segmentWithAttrPrisma = {
      ...mockSegmentPrisma,
      id: "seg-attr-1",
      filters: [
        {
          connector: null,
          resource: {
            root: { type: "attribute", contactAttributeKey: attributeKey },
            qualifier: { operator: "equals" },
            value: "test@test.com",
          },
        },
      ],
    } as unknown as PrismaSegment;
    const segmentWithoutAttrPrisma = { ...mockSegmentPrisma, id: "seg-attr-2", filters: [] };

    beforeEach(() => {
      vi.mocked(prisma.segment.findMany).mockResolvedValue([segmentWithAttrPrisma, segmentWithoutAttrPrisma]);
    });

    test("should return segments containing the attribute key", async () => {
      const result = await getSegmentsByAttributeKey("workspace-id-mock", attributeKey);
      expect(result).toEqual([segmentWithAttrPrisma]);
      expect(prisma.segment.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "workspace-id-mock" },
        select: selectSegment,
      });
      expect(validateInputs).toHaveBeenCalledWith(
        ["workspace-id-mock", expect.any(Object)],
        [attributeKey, expect.any(Object)]
      );
    });

    test("should return empty array if no segments match", async () => {
      const result = await getSegmentsByAttributeKey("workspace-id-mock", "nonexistentKey");
      expect(result).toEqual([]);
    });

    test("should return segments with nested attribute key", async () => {
      const nestedSegmentPrisma = {
        ...mockSegmentPrisma,
        id: "seg-attr-nested",
        filters: [
          {
            connector: null,
            resource: [
              {
                connector: null,
                resource: {
                  root: { type: "attribute", contactAttributeKey: attributeKey },
                  qualifier: { operator: "equals" },
                  value: "nested@test.com",
                },
              },
            ],
          },
        ],
      } as unknown as PrismaSegment;
      vi.mocked(prisma.segment.findMany).mockResolvedValue([nestedSegmentPrisma, segmentWithoutAttrPrisma]);

      const result = await getSegmentsByAttributeKey("workspace-id-mock", attributeKey);
      expect(result).toEqual([nestedSegmentPrisma]);
    });

    test("should throw DatabaseError on Prisma error", async () => {
      vi.mocked(prisma.segment.findMany).mockRejectedValue(new Error("DB error"));
      await expect(getSegmentsByAttributeKey("workspace-id-mock", attributeKey)).rejects.toThrow(Error);
    });
  });

  describe("compareValues", () => {
    test.each([
      ["equals", "hello", "hello", true],
      ["equals", "hello", "world", false],
      ["notEquals", "hello", "world", true],
      ["notEquals", "hello", "hello", false],
      ["contains", "hello world", "world", true],
      ["contains", "hello world", "planet", false],
      ["doesNotContain", "hello world", "planet", true],
      ["doesNotContain", "hello world", "world", false],
      ["startsWith", "hello world", "hello", true],
      ["startsWith", "hello world", "world", false],
      ["endsWith", "hello world", "world", true],
      ["endsWith", "hello world", "hello", false],
      ["equals", 10, 10, true],
      ["equals", 10, 5, false],
      ["notEquals", 10, 5, true],
      ["notEquals", 10, 10, false],
      ["lessThan", 5, 10, true],
      ["lessThan", 10, 5, false],
      ["lessThan", 5, 5, false],
      ["lessEqual", 5, 10, true],
      ["lessEqual", 5, 5, true],
      ["lessEqual", 10, 5, false],
      ["greaterThan", 10, 5, true],
      ["greaterThan", 5, 10, false],
      ["greaterThan", 5, 5, false],
      ["greaterEqual", 10, 5, true],
      ["greaterEqual", 5, 5, true],
      ["greaterEqual", 5, 10, false],
      ["isSet", "hello", "", true],
      ["isSet", 0, "", true],
      ["isSet", undefined, "", false],
      ["isNotSet", "", "", true],
      ["isNotSet", null, "", true],
      ["isNotSet", undefined, "", true],
      ["isNotSet", "hello", "", false],
      ["isNotSet", 0, "", false],
    ])("should return %s for operator '%s' with values '%s' and '%s'", (operator, a, b, expected) => {
      //@ts-expect-error ignore
      expect(compareValues(a, b, operator)).toBe(expected);
    });

    test("should throw error for unknown operator", () => {
      //@ts-expect-error ignore
      expect(() => compareValues("a", "b", "unknownOperator")).toThrow(
        "Unexpected operator: unknownOperator"
      );
    });
  });

  describe("evaluateSegment", () => {
    const userId = "user-123";
    const userData = {
      userId,
      attributes: { email: "test@example.com", plan: "premium", age: 30 },
      deviceType: "desktop" as const,
    } as unknown as TEvaluateSegmentUserData;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    test("should return true for empty filters", async () => {
      const result = await evaluateSegment(userData, []);
      expect(result).toBe(true);
    });

    test("should evaluate attribute 'equals' correctly (true)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID to the resource object
            root: { type: "attribute", contactAttributeKey: "email" },
            qualifier: { operator: "equals" },
            value: "test@example.com",
          },
        },
      ] as TBaseFilters; // Cast needed for evaluateSegment input type
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(true);
    });

    test("should evaluate attribute 'equals' correctly (false)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID to the resource object
            root: { type: "attribute", contactAttributeKey: "email" },
            qualifier: { operator: "equals" },
            value: "wrong@example.com",
          },
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(false);
    });

    test("should evaluate attribute 'isNotSet' correctly (false)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID to the resource object
            root: { type: "attribute", contactAttributeKey: "email" },
            qualifier: { operator: "isNotSet" },
            value: "", // Value doesn't matter but schema expects it
          },
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(false);
    });

    test("should evaluate attribute 'isSet' correctly (true)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID to the resource object
            root: { type: "attribute", contactAttributeKey: "email" },
            qualifier: { operator: "isSet" },
            value: "", // Value doesn't matter but schema expects it
          },
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(true);
    });

    test("should evaluate attribute 'greaterThan' (number) correctly (true)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID to the resource object
            root: { type: "attribute", contactAttributeKey: "age" },
            qualifier: { operator: "greaterThan" },
            value: 25,
          },
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(true);
    });

    test("should evaluate person 'userId' 'equals' correctly (true)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID to the resource object
            root: { type: "person", personIdentifier: "userId" },
            qualifier: { operator: "equals" },
            value: userId,
          },
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(true);
    });

    test("should evaluate person 'userId' 'equals' correctly (false)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID to the resource object
            root: { type: "person", personIdentifier: "userId" },
            qualifier: { operator: "equals" },
            value: "wrong-user-id",
          },
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(false);
    });

    test("should evaluate device 'equals' correctly (true)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID to the resource object
            root: { type: "device", deviceType: "desktop" },
            qualifier: { operator: "equals" },
            value: "desktop",
          },
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(true);
    });

    test("should evaluate device 'notEquals' correctly (true)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID to the resource object
            root: { type: "device" }, // deviceType is missing
            qualifier: { operator: "notEquals" },
            value: "phone",
          },
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(true);
    });

    test("should evaluate segment 'userIsIn' correctly (true)", async () => {
      const otherSegmentId = "other-segment-id";
      const otherSegmentFilters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID to the resource object
            root: { type: "attribute", contactAttributeKey: "plan" },
            qualifier: { operator: "equals" },
            value: "premium",
          },
        },
      ];
      const otherSegmentPrisma = {
        ...mockSegmentPrisma,
        id: otherSegmentId,
        filters: otherSegmentFilters,
        surveys: [],
      };

      vi.mocked(prisma.segment.findUnique, { partial: true, deep: true }).mockImplementation(async (args) => {
        if (args?.where?.id === otherSegmentId) {
          return structuredClone(otherSegmentPrisma);
        }
        return null;
      });

      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID to the resource object
            root: { type: "segment", segmentId: otherSegmentId },
            qualifier: { operator: "userIsIn" },
            value: "", // Value doesn't matter but schema expects it
          },
        },
      ] as TBaseFilters;

      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(true);
      expect(prisma.segment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: otherSegmentId } })
      );
    });

    test("should evaluate segment 'userIsNotIn' correctly (true)", async () => {
      const otherSegmentId = "other-segment-id-2";
      const otherSegmentFilters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID to the resource object
            root: { type: "attribute", contactAttributeKey: "plan" },
            qualifier: { operator: "equals" },
            value: "free",
          },
        },
      ];
      const otherSegmentPrisma = {
        ...mockSegmentPrisma,
        id: otherSegmentId,
        filters: otherSegmentFilters,
        surveys: [],
      };

      vi.mocked(prisma.segment.findUnique, { partial: true, deep: true }).mockImplementation(async (args) => {
        if (args?.where?.id === otherSegmentId) {
          return structuredClone(otherSegmentPrisma);
        }
        return null;
      });

      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID to the resource object
            root: { type: "segment", segmentId: otherSegmentId },
            qualifier: { operator: "userIsNotIn" },
            value: "", // Value doesn't matter but schema expects it
          },
        },
      ] as TBaseFilters;

      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(true);
      expect(prisma.segment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: otherSegmentId } })
      );
    });

    test("should throw ResourceNotFoundError if referenced segment in filter is not found", async () => {
      const nonExistentSegmentId = "non-existent-segment";

      // Mock findUnique to return null, which causes getSegment to throw
      vi.mocked(prisma.segment.findUnique, { partial: true, deep: true }).mockImplementation(async (args) => {
        if (args?.where?.id === nonExistentSegmentId) {
          return null;
        }
        // Mock return for other potential calls if necessary, or keep returning null
        return null;
      });

      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(),
            root: { type: "segment", segmentId: nonExistentSegmentId },
            qualifier: { operator: "userIsIn" },
            value: "",
          },
        },
      ] as TBaseFilters;

      // Assert that calling evaluateSegment rejects with the specific error
      await expect(evaluateSegment(userData, filters)).rejects.toThrow(ResourceNotFoundError);

      // Verify findUnique was called as expected
      expect(prisma.segment.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: nonExistentSegmentId } })
      );
    });

    test("should evaluate 'and' connector correctly (true)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID
            root: { type: "attribute", contactAttributeKey: "email" },
            qualifier: { operator: "equals" },
            value: "test@example.com",
          },
        },
        {
          id: createId(),
          connector: "and",
          resource: {
            id: createId(), // Add ID
            root: { type: "attribute", contactAttributeKey: "plan" },
            qualifier: { operator: "equals" },
            value: "premium",
          },
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(true);
    });

    test("should evaluate 'and' connector correctly (false)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID
            root: { type: "attribute", contactAttributeKey: "email" },
            qualifier: { operator: "equals" },
            value: "test@example.com",
          },
        },
        {
          id: createId(),
          connector: "and",
          resource: {
            id: createId(), // Add ID
            root: { type: "attribute", contactAttributeKey: "plan" },
            qualifier: { operator: "equals" },
            value: "free",
          },
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(false);
    });

    test("should evaluate 'or' connector correctly (true)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID
            root: { type: "attribute", contactAttributeKey: "email" },
            qualifier: { operator: "equals" },
            value: "wrong@example.com",
          },
        },
        {
          id: createId(),
          connector: "or",
          resource: {
            id: createId(), // Add ID
            root: { type: "attribute", contactAttributeKey: "plan" },
            qualifier: { operator: "equals" },
            value: "premium",
          },
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(true);
    });

    test("should evaluate 'or' connector correctly (false)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID
            root: { type: "attribute", contactAttributeKey: "email" },
            qualifier: { operator: "equals" },
            value: "wrong@example.com",
          },
        },
        {
          id: createId(),
          connector: "or",
          resource: {
            id: createId(), // Add ID
            root: { type: "attribute", contactAttributeKey: "plan" },
            qualifier: { operator: "equals" },
            value: "free",
          },
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(false);
    });

    test("should evaluate complex 'and'/'or' combination", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID
            root: { type: "attribute", contactAttributeKey: "email" },
            qualifier: { operator: "equals" },
            value: "test@example.com",
          },
        },
        {
          id: createId(),
          connector: "and",
          resource: {
            id: createId(), // Add ID
            root: { type: "attribute", contactAttributeKey: "plan" },
            qualifier: { operator: "equals" },
            value: "free",
          },
        },
        {
          id: createId(),
          connector: "or",
          resource: {
            id: createId(), // Add ID
            root: { type: "attribute", contactAttributeKey: "age" },
            qualifier: { operator: "greaterThan" },
            value: 25,
          },
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(true);
    });

    test("should evaluate nested filters correctly (true)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID
            root: { type: "attribute", contactAttributeKey: "email" },
            qualifier: { operator: "equals" },
            value: "test@example.com",
          },
        },
        {
          id: createId(),
          connector: "and",
          resource: [
            // Nested group - resource array doesn't need an ID itself
            {
              id: createId(),
              connector: null,
              resource: {
                id: createId(), // Add ID
                root: { type: "attribute", contactAttributeKey: "plan" },
                qualifier: { operator: "equals" },
                value: "premium",
              },
            },
            {
              id: createId(),
              connector: "or",
              resource: {
                id: createId(), // Add ID
                root: { type: "attribute", contactAttributeKey: "age" },
                qualifier: { operator: "lessThan" },
                value: 20,
              },
            },
          ],
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(true);
    });

    test("should evaluate nested filters correctly (false)", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(), // Add ID
            root: { type: "attribute", contactAttributeKey: "email" },
            qualifier: { operator: "equals" },
            value: "wrong@example.com",
          },
        },
        {
          id: createId(),
          connector: "or",
          resource: [
            // Nested group
            {
              id: createId(),
              connector: null,
              resource: {
                id: createId(), // Add ID
                root: { type: "attribute", contactAttributeKey: "plan" },
                qualifier: { operator: "equals" },
                value: "free",
              },
            },
            {
              id: createId(),
              connector: "and",
              resource: {
                id: createId(), // Add ID
                root: { type: "attribute", contactAttributeKey: "age" },
                qualifier: { operator: "greaterThan" },
                value: 40,
              },
            },
          ],
        },
      ] as TBaseFilters;
      const result = await evaluateSegment(userData, filters);
      expect(result).toBe(false);
    });

    test("should log and rethrow error during evaluation", async () => {
      const filters = [
        {
          id: createId(),
          connector: null,
          resource: {
            id: createId(),
            // Use 'age' (a number) with 'startsWith' (a string operator) to force a TypeError in compareValues
            root: { type: "attribute", contactAttributeKey: "age" },
            qualifier: { operator: "startsWith" },
            value: "3", // The value itself doesn't matter much here
          },
        },
      ] as TBaseFilters;

      // Now, evaluateAttributeFilter will call compareValues('30', '3', 'startsWith')
      // compareValues will attempt ('30' as string).startsWith('3'), which should throw a TypeError
      // This TypeError should be caught by the try...catch in evaluateSegment
      await expect(evaluateSegment(userData, filters)).rejects.toThrow(TypeError); // Expect a TypeError specifically
      expect(logger.error).toHaveBeenCalledWith(expect.any(TypeError), "Error evaluating segment");
    });
  });
});
