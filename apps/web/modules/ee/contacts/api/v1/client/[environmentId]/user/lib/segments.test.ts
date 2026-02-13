import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TBaseFilter } from "@formbricks/types/segment";
import { validateInputs } from "@/lib/utils/validate";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import { getPersonSegmentIds, getSegments } from "./segments";

// Mock the cache functions
vi.mock("@/lib/cache", () => ({
  cache: {
    withCache: vi.fn(async (fn) => await fn()), // Just execute the function without caching for tests
  },
}));

vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));

vi.mock("@/modules/ee/contacts/segments/lib/filter/prisma-query", () => ({
  segmentFilterToPrismaQuery: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    segment: {
      findMany: vi.fn(),
    },
    contact: {
      findFirst: vi.fn(),
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

const mockEnvironmentId = "test-environment-id";
const mockContactId = "test-contact-id";
const mockContactUserId = "test-contact-user-id";
const mockDeviceType = "desktop" as const;

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
      vi.mocked(prisma.segment.findMany).mockResolvedValue(
        mockSegmentsData as Prisma.Result<typeof prisma.segment, unknown, "findMany">
      );

      const result = await getSegments(mockEnvironmentId);

      expect(prisma.segment.findMany).toHaveBeenCalledWith({
        where: { environmentId: mockEnvironmentId },
        select: { id: true, filters: true },
      });

      expect(result).toEqual(mockSegmentsData);
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
      vi.mocked(prisma.segment.findMany).mockResolvedValue(
        mockSegmentsData as Prisma.Result<typeof prisma.segment, unknown, "findMany">
      );
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: { AND: [{ environmentId: mockEnvironmentId }, {}] } },
      });
    });

    test("should return person segment IDs successfully", async () => {
      vi.mocked(prisma.contact.findFirst).mockResolvedValue({ id: mockContactId } as Prisma.Result<
        typeof prisma.contact,
        unknown,
        "findFirst"
      >);

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockDeviceType
      );

      expect(validateInputs).toHaveBeenCalled();
      expect(prisma.segment.findMany).toHaveBeenCalledWith({
        where: { environmentId: mockEnvironmentId },
        select: { id: true, filters: true },
      });

      expect(segmentFilterToPrismaQuery).toHaveBeenCalledTimes(mockSegmentsData.length);
      expect(prisma.contact.findFirst).toHaveBeenCalledTimes(mockSegmentsData.length);
      expect(result).toEqual(mockSegmentsData.map((s) => s.id));
    });

    test("should return empty array if no segments exist", async () => {
      vi.mocked(prisma.segment.findMany).mockResolvedValue([]); // No segments

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockDeviceType
      );

      expect(result).toEqual([]);
      expect(segmentFilterToPrismaQuery).not.toHaveBeenCalled();
    });

    test("should return empty array if segments exist but none match", async () => {
      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockDeviceType
      );
      expect(result).toEqual([]);
      expect(segmentFilterToPrismaQuery).toHaveBeenCalledTimes(mockSegmentsData.length);
    });

    test("should call validateInputs with correct parameters", async () => {
      vi.mocked(prisma.contact.findFirst).mockResolvedValue({ id: mockContactId } as Prisma.Result<
        typeof prisma.contact,
        unknown,
        "findFirst"
      >);

      await getPersonSegmentIds(mockEnvironmentId, mockContactId, mockContactUserId, mockDeviceType);
      expect(validateInputs).toHaveBeenCalledWith(
        [mockEnvironmentId, expect.anything()],
        [mockContactId, expect.anything()],
        [mockContactUserId, expect.anything()]
      );
    });

    test("should return only matching segment IDs", async () => {
      // First segment matches, second doesn't
      vi.mocked(prisma.contact.findFirst)
        .mockResolvedValueOnce({ id: mockContactId } as Prisma.Result<
          typeof prisma.contact,
          unknown,
          "findFirst"
        >) // First segment matches
        .mockResolvedValueOnce(null); // Second segment does not match

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockDeviceType
      );

      expect(result).toEqual([mockSegmentsData[0].id]);
      expect(segmentFilterToPrismaQuery).toHaveBeenCalledTimes(mockSegmentsData.length);
    });
  });
});
