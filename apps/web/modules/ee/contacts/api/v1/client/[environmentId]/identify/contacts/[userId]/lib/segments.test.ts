import {
  getPersonSegmentIds,
  getSegments,
} from "@/modules/ee/contacts/api/v1/client/[environmentId]/user/lib/segments";
import { evaluateSegment } from "@/modules/ee/contacts/segments/lib/segments";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError } from "@formbricks/types/errors";
import { TBaseFilter } from "@formbricks/types/segment";

// Mock the cache functions
vi.mock("@/modules/cache/lib/withCache", () => ({
  withCache: vi.fn((fn) => fn), // Just execute the function without caching for tests
}));

vi.mock("@/modules/cache/lib/cacheKeys", () => ({
  createCacheKey: {
    environment: {
      segments: vi.fn((environmentId) => `segments-${environmentId}`),
    },
  },
}));

// Mock React cache
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    cache: <T extends (...args: any[]) => any>(fn: T): T => fn, // Return the function with the same type signature
  };
});

vi.mock("@/modules/ee/contacts/segments/lib/segments", () => ({
  evaluateSegment: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    segment: {
      findMany: vi.fn(),
    },
  },
}));

const mockEnvironmentId = "bbn7e47f6etoai6usxezxd4a";
const mockContactId = "cworhmq5yqvnb0tsfw9yka4b";
const mockContactUserId = "xrgbcxn5y9so92igacthutfw";
const mockDeviceType = "desktop";

const mockSegmentsData = [
  {
    id: "segment1",
    filters: [{}] as TBaseFilter[],
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: mockEnvironmentId,
    description: null,
    title: "Segment 1",
    isPrivate: false,
  },
  {
    id: "segment2",
    filters: [{}] as TBaseFilter[],
    createdAt: new Date(),
    updatedAt: new Date(),
    environmentId: mockEnvironmentId,
    description: null,
    title: "Segment 2",
    isPrivate: false,
  },
];

const mockContactAttributesData = {
  attribute1: "value1",
  attribute2: "value2",
};

describe("segments lib", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getSegments", () => {
    test("should return segments successfully", async () => {
      vi.mocked(prisma.segment.findMany).mockResolvedValue(mockSegmentsData);

      const result = await getSegments(mockEnvironmentId);

      expect(prisma.segment.findMany).toHaveBeenCalledWith({
        where: { environmentId: mockEnvironmentId },
        select: { id: true, filters: true },
      });

      expect(result).toEqual(mockSegmentsData);
    });

    test("should throw DatabaseError on Prisma known request error", async () => {
      const mockErrorMessage = "Prisma error";
      const errToThrow = new Prisma.PrismaClientKnownRequestError(mockErrorMessage, {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "0.0.1",
      });

      vi.mocked(prisma.segment.findMany).mockRejectedValueOnce(errToThrow);
      await expect(getSegments(mockEnvironmentId)).rejects.toThrow(DatabaseError);
    });

    test("should throw original error on other errors", async () => {
      const genericError = new Error("Test Generic Error");

      vi.mocked(prisma.segment.findMany).mockRejectedValueOnce(genericError);
      await expect(getSegments(mockEnvironmentId)).rejects.toThrow("Test Generic Error");
    });
  });

  describe("getPersonSegmentIds", () => {
    beforeEach(() => {
      vi.mocked(prisma.segment.findMany).mockResolvedValue(mockSegmentsData); // Mock for getSegments call
    });

    test("should return person segment IDs successfully", async () => {
      vi.mocked(evaluateSegment).mockResolvedValue(true); // All segments evaluate to true

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockContactAttributesData,
        mockDeviceType
      );

      expect(evaluateSegment).toHaveBeenCalledTimes(mockSegmentsData.length);

      mockSegmentsData.forEach((segment) => {
        expect(evaluateSegment).toHaveBeenCalledWith(
          {
            attributes: mockContactAttributesData,
            deviceType: mockDeviceType,
            environmentId: mockEnvironmentId,
            contactId: mockContactId,
            userId: mockContactUserId,
          },
          segment.filters
        );
      });

      expect(result).toEqual(mockSegmentsData.map((s) => s.id));
    });

    test("should return empty array if no segments exist", async () => {
      // @ts-expect-error -- this is a valid test case to check for null
      vi.mocked(prisma.segment.findMany).mockResolvedValue(null); // No segments

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockContactAttributesData,
        mockDeviceType
      );

      expect(result).toEqual([]);
      expect(evaluateSegment).not.toHaveBeenCalled();
    });

    test("should return empty array if segments is null", async () => {
      vi.mocked(prisma.segment.findMany).mockResolvedValue(null as any); // segments is null

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockContactAttributesData,
        mockDeviceType
      );

      expect(result).toEqual([]);
      expect(evaluateSegment).not.toHaveBeenCalled();
    });

    test("should return only matching segment IDs", async () => {
      vi.mocked(evaluateSegment)
        .mockResolvedValueOnce(true) // First segment matches
        .mockResolvedValueOnce(false); // Second segment does not match

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockContactAttributesData,
        mockDeviceType
      );

      expect(result).toEqual([mockSegmentsData[0].id]);
      expect(evaluateSegment).toHaveBeenCalledTimes(mockSegmentsData.length);
    });
  });
});
