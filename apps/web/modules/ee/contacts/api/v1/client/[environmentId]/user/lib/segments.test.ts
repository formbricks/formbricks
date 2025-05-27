import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { segmentCache } from "@/lib/cache/segment";
import { validateInputs } from "@/lib/utils/validate";
import { evaluateSegment } from "@/modules/ee/contacts/segments/lib/segments";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
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

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

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

const mockEnvironmentId = "test-environment-id";
const mockContactId = "test-contact-id";
const mockContactUserId = "test-contact-user-id";
const mockAttributes = { email: "test@example.com" };
const mockDeviceType = "desktop";

const mockSegmentsData = [
  { id: "segment1", filters: [{}] as TBaseFilter[] },
  { id: "segment2", filters: [{}] as TBaseFilter[] },
];

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
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2001",
        clientVersion: "2.0.0",
      });

      vi.mocked(prisma.segment.findMany).mockRejectedValue(prismaError);

      await expect(getSegments(mockEnvironmentId)).rejects.toThrow(DatabaseError);
    });

    test("should throw generic error if not Prisma error", async () => {
      const genericError = new Error("Test Generic Error");
      vi.mocked(prisma.segment.findMany).mockRejectedValue(genericError);

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
        mockAttributes,
        mockDeviceType
      );

      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.segment.findMany).toHaveBeenCalledWith({
        where: { environmentId: mockEnvironmentId },
        select: { id: true, filters: true },
      });

      expect(evaluateSegment).toHaveBeenCalledTimes(mockSegmentsData.length);
      mockSegmentsData.forEach((segment) => {
        expect(evaluateSegment).toHaveBeenCalledWith(
          {
            attributes: mockAttributes,
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
      vi.mocked(prisma.segment.findMany).mockResolvedValue([]); // No segments

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockAttributes,
        mockDeviceType
      );

      expect(result).toEqual([]);
      expect(evaluateSegment).not.toHaveBeenCalled();
    });

    test("should return empty array if segments exist but none match", async () => {
      vi.mocked(evaluateSegment).mockResolvedValue(false); // All segments evaluate to false

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockAttributes,
        mockDeviceType
      );
      expect(result).toEqual([]);
      expect(evaluateSegment).toHaveBeenCalledTimes(mockSegmentsData.length);
    });

    test("should call validateInputs with correct parameters", async () => {
      await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockAttributes,
        mockDeviceType
      );
      expect(validateInputs).toHaveBeenCalledWith(
        [mockEnvironmentId, expect.anything()],
        [mockContactId, expect.anything()],
        [mockContactUserId, expect.anything()]
      );
    });

    test("should return only matching segment IDs", async () => {
      vi.mocked(evaluateSegment)
        .mockResolvedValueOnce(true) // First segment matches
        .mockResolvedValueOnce(false); // Second segment does not match

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockAttributes,
        mockDeviceType
      );

      expect(result).toEqual([mockSegmentsData[0].id]);
      expect(evaluateSegment).toHaveBeenCalledTimes(mockSegmentsData.length);
    });
  });
});
