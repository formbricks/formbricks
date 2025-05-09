import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { segmentCache } from "@/lib/cache/segment";
import { getContactAttributes } from "@/modules/ee/contacts/api/v1/client/[environmentId]/identify/contacts/[userId]/lib/attributes";
import { evaluateSegment } from "@/modules/ee/contacts/segments/lib/segments";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError } from "@formbricks/types/errors";
import { TBaseFilter } from "@formbricks/types/segment";
import { getPersonSegmentIds, getSegments } from "./segments";

vi.mock("@/lib/cache/contact-attribute", () => ({
  contactAttributeCache: {
    tag: {
      byContactId: vi.fn((contactId) => `contactAttributeCache-contactId-${contactId}`),
    },
  },
}));

vi.mock("@/lib/cache/segment", () => ({
  segmentCache: {
    tag: {
      byEnvironmentId: vi.fn((environmentId) => `segmentCache-environmentId-${environmentId}`),
    },
  },
}));

vi.mock(
  "@/modules/ee/contacts/api/v1/client/[environmentId]/identify/contacts/[userId]/lib/attributes",
  () => ({
    getContactAttributes: vi.fn(),
  })
);

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
  { id: "segment1", filters: [{}] as TBaseFilter[] },
  { id: "segment2", filters: [{}] as TBaseFilter[] },
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
      expect(segmentCache.tag.byEnvironmentId).toHaveBeenCalledWith(mockEnvironmentId);
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
      vi.mocked(getContactAttributes).mockResolvedValue(mockContactAttributesData);
      vi.mocked(prisma.segment.findMany).mockResolvedValue(mockSegmentsData); // Mock for getSegments call
    });

    test("should return person segment IDs successfully", async () => {
      vi.mocked(evaluateSegment).mockResolvedValue(true); // All segments evaluate to true

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockDeviceType
      );

      expect(getContactAttributes).toHaveBeenCalledWith(mockContactId);
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
      expect(segmentCache.tag.byEnvironmentId).toHaveBeenCalledWith(mockEnvironmentId);
      expect(contactAttributeCache.tag.byContactId).toHaveBeenCalledWith(mockContactId);
    });

    test("should return empty array if no segments exist", async () => {
      // @ts-expect-error -- this is a valid test case to check for null
      vi.mocked(prisma.segment.findMany).mockResolvedValue(null); // No segments

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockDeviceType
      );

      expect(result).toEqual([]);
      expect(getContactAttributes).not.toHaveBeenCalled();
      expect(evaluateSegment).not.toHaveBeenCalled();
    });

    test("should return empty array if segments is null", async () => {
      vi.mocked(prisma.segment.findMany).mockResolvedValue(null as any); // segments is null

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockDeviceType
      );

      expect(result).toEqual([]);
      expect(getContactAttributes).not.toHaveBeenCalled();
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
        mockDeviceType
      );

      expect(result).toEqual([mockSegmentsData[0].id]);
      expect(evaluateSegment).toHaveBeenCalledTimes(mockSegmentsData.length);
    });
  });
});
