import { validateInputs } from "@/lib/utils/validate";
import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import {
  OperationNotAllowedError,
  ResourceNotFoundError,
  // Ensure ResourceNotFoundError is imported
  ValidationError,
} from "@formbricks/types/errors";
import {
  TBaseFilters,
  TEvaluateSegmentUserData,
  TSegment,
  TSegmentCreateInput,
  TSegmentUpdateInput,
} from "@formbricks/types/segment";
import {
  PrismaSegment,
  cloneSegment,
  compareValues,
  createSegment,
  deleteSegment,
  evaluateSegment,
  getSegment,
  getSegments,
  getSegmentsByAttributeKey,
  resetSegmentInSurvey,
  selectSegment,
  transformPrismaSegment,
  updateSegment,
} from "./segments";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    segment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    survey: {
      update: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)), // Mock transaction to execute the callback
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
const environmentId = "test-env-id";
const segmentId = "test-segment-id";
const surveyId = "test-survey-id";
const attributeKey = "email";

const mockSegmentPrisma = {
  id: segmentId,
  createdAt: new Date(),
  updatedAt: new Date(),
  title: "Test Segment",
  description: "This is a test segment",
  environmentId,
  filters: [],
  isPrivate: false,
  surveys: [{ id: surveyId, name: "Test Survey", status: "inProgress" }],
};

const mockSegment: TSegment = {
  ...mockSegmentPrisma,
  surveys: [surveyId],
};

const mockSegmentCreateInput = {
  environmentId,
  title: "New Segment",
  isPrivate: false,
  filters: [],
} as unknown as TSegmentCreateInput;

const mockSurvey = {
  id: surveyId,
  environmentId,
  name: "Test Survey",
  status: "inProgress",
};

describe("Segment Service Tests", () => {
  describe("transformPrismaSegment", () => {
    test("should transform Prisma segment to TSegment", () => {
      const transformed = transformPrismaSegment(mockSegmentPrisma);
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
      const segments = await getSegments(environmentId);
      expect(segments).toEqual([mockSegment]);
      expect(prisma.segment.findMany).toHaveBeenCalledWith({
        where: { environmentId },
        select: selectSegment,
      });
      expect(validateInputs).toHaveBeenCalledWith([environmentId, expect.any(Object)]);
    });

    test("should return an empty array if no segments found", async () => {
      vi.mocked(prisma.segment.findMany).mockResolvedValue([]);
      const segments = await getSegments(environmentId);
      expect(segments).toEqual([]);
    });

    test("should throw DatabaseError on Prisma error", async () => {
      vi.mocked(prisma.segment.findMany).mockRejectedValue(new Error("DB error"));
      await expect(getSegments(environmentId)).rejects.toThrow(Error);
    });
  });

  describe("createSegment", () => {
    test("should create a segment without surveyId", async () => {
      vi.mocked(prisma.segment.create).mockResolvedValue(mockSegmentPrisma);
      const segment = await createSegment(mockSegmentCreateInput);
      expect(segment).toEqual(mockSegment);
      expect(prisma.segment.create).toHaveBeenCalledWith({
        data: {
          environmentId,
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
          environmentId,
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
  });

  describe("cloneSegment", () => {
    const clonedSegmentId = "cloned-segment-id";
    const clonedSegmentPrisma = {
      ...mockSegmentPrisma,
      id: clonedSegmentId,
      title: "Copy of Test Segment (1)",
    };
    const clonedSegment = { ...mockSegment, id: clonedSegmentId, title: "Copy of Test Segment (1)" };

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
        where: { environmentId },
        select: selectSegment,
      });
      expect(prisma.segment.create).toHaveBeenCalledWith({
        data: {
          title: "Copy of Test Segment (1)",
          description: mockSegment.description,
          isPrivate: mockSegment.isPrivate,
          environmentId: mockSegment.environmentId,
          filters: mockSegment.filters,
          surveys: { connect: { id: surveyId } },
        },
        select: selectSegment,
      });
    });

    test("should clone a segment successfully with incremented suffix", async () => {
      const existingCopyPrisma = { ...mockSegmentPrisma, id: "copy-1", title: "Copy of Test Segment (1)" };
      const clonedSegmentPrisma2 = { ...clonedSegmentPrisma, title: "Copy of Test Segment (2)" };
      const clonedSegment2 = { ...clonedSegment, title: "Copy of Test Segment (2)" };

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
      const invalidFilterSegment = { ...mockSegmentPrisma, filters: "invalid" as any };
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
    const segmentToDelete = { ...mockSegment, surveys: [] };

    beforeEach(() => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(segmentToDeletePrisma);
      vi.mocked(prisma.segment.delete).mockResolvedValue(segmentToDeletePrisma);
    });

    test("should delete a segment successfully", async () => {
      const result = await deleteSegment(segmentId);
      expect(result).toEqual(segmentToDelete);
      expect(prisma.segment.findUnique).toHaveBeenCalledWith({
        where: { id: segmentId },
        select: selectSegment,
      });
      expect(prisma.segment.delete).toHaveBeenCalledWith({
        where: { id: segmentId },
        select: selectSegment,
      });
    });

    test("should throw ResourceNotFoundError if segment not found", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(null);
      await expect(deleteSegment(segmentId)).rejects.toThrow(ResourceNotFoundError);
    });

    test("should throw OperationNotAllowedError if segment is linked to surveys", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);
      await expect(deleteSegment(segmentId)).rejects.toThrow(OperationNotAllowedError);
    });

    test("should throw DatabaseError on Prisma delete error", async () => {
      vi.mocked(prisma.segment.delete).mockRejectedValue(new Error("DB delete error"));
      await expect(deleteSegment(segmentId)).rejects.toThrow(Error);
    });
  });

  describe("resetSegmentInSurvey", () => {
    const privateSegmentId = "private-segment-id";
    const privateSegmentPrisma = {
      ...mockSegmentPrisma,
      id: privateSegmentId,
      title: surveyId,
      isPrivate: true,
      filters: [{ connector: null, resource: [] }],
      surveys: [{ id: surveyId, name: "Test Survey", status: "inProgress" }],
    };
    const resetPrivateSegmentPrisma = { ...privateSegmentPrisma, filters: [] };
    const resetPrivateSegment = {
      ...mockSegment,
      id: privateSegmentId,
      title: surveyId,
      isPrivate: true,
      filters: [],
    };

    beforeEach(() => {
      vi.mocked(getSurvey).mockResolvedValue(mockSurvey as any);
      vi.mocked(prisma.segment.findFirst).mockResolvedValue(privateSegmentPrisma);
      vi.mocked(prisma.survey.update).mockResolvedValue({} as any);
      vi.mocked(prisma.segment.update).mockResolvedValue(resetPrivateSegmentPrisma);
      vi.mocked(prisma.segment.create).mockResolvedValue(resetPrivateSegmentPrisma);
    });

    test("should reset filters of existing private segment", async () => {
      const result = await resetSegmentInSurvey(surveyId);

      expect(result).toEqual(resetPrivateSegment);
      expect(getSurvey).toHaveBeenCalledWith(surveyId);
      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.segment.findFirst).toHaveBeenCalledWith({
        where: { title: surveyId, isPrivate: true },
        select: selectSegment,
      });
      expect(prisma.survey.update).toHaveBeenCalledWith({
        where: { id: surveyId },
        data: { segment: { connect: { id: privateSegmentId } } },
      });
      expect(prisma.segment.update).toHaveBeenCalledWith({
        where: { id: privateSegmentId },
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
          environment: { connect: { id: environmentId } },
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
    const updatedSegment = { ...mockSegment, title: "Updated Segment" };
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

    test("should update segment with survey connections", async () => {
      vi.mocked(prisma.segment.findUnique).mockResolvedValue(mockSegmentPrisma);

      const newSurveyId = "new-survey-id";
      const updateDataWithSurveys: TSegmentUpdateInput = { ...updateData, surveys: [newSurveyId] };
      const updatedSegmentPrismaWithSurvey = {
        ...updatedSegmentPrisma,
        surveys: [{ id: newSurveyId, name: "New Survey", status: "draft" }],
      };
      const updatedSegmentWithSurvey = { ...updatedSegment, surveys: [newSurveyId] };

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
      const result = await getSegmentsByAttributeKey(environmentId, attributeKey);
      expect(result).toEqual([segmentWithAttrPrisma]);
      expect(prisma.segment.findMany).toHaveBeenCalledWith({
        where: { environmentId },
        select: selectSegment,
      });
      expect(validateInputs).toHaveBeenCalledWith(
        [environmentId, expect.any(Object)],
        [attributeKey, expect.any(Object)]
      );
    });

    test("should return empty array if no segments match", async () => {
      const result = await getSegmentsByAttributeKey(environmentId, "nonexistentKey");
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

      const result = await getSegmentsByAttributeKey(environmentId, attributeKey);
      expect(result).toEqual([nestedSegmentPrisma]);
    });

    test("should throw DatabaseError on Prisma error", async () => {
      vi.mocked(prisma.segment.findMany).mockRejectedValue(new Error("DB error"));
      await expect(getSegmentsByAttributeKey(environmentId, attributeKey)).rejects.toThrow(Error);
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

      vi.mocked(prisma.segment.findUnique).mockImplementation((async (args) => {
        if (args?.where?.id === otherSegmentId) {
          return structuredClone(otherSegmentPrisma);
        }
        return null;
      }) as any);

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

      vi.mocked(prisma.segment.findUnique).mockImplementation((async (args) => {
        if (args?.where?.id === otherSegmentId) {
          return structuredClone(otherSegmentPrisma);
        }
        return null;
      }) as any);

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
      vi.mocked(prisma.segment.findUnique).mockImplementation((async (args) => {
        if (args?.where?.id === nonExistentSegmentId) {
          return null;
        }
        // Mock return for other potential calls if necessary, or keep returning null
        return null;
      }) as any);

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
      expect(logger.error).toHaveBeenCalledWith("Error evaluating segment", expect.any(TypeError));
    });
  });
});
