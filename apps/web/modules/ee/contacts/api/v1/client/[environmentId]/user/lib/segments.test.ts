import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TBaseFilter } from "@formbricks/types/segment";
import { validateInputs } from "@/lib/utils/validate";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";
import { getPersonSegmentIds, getSegments } from "./segments";

vi.mock("@/lib/cache", () => ({
  cache: {
    withCache: vi.fn(async (fn) => await fn()),
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
    $transaction: vi.fn(),
  },
}));

vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    cache: <T extends (...args: any[]) => any>(fn: T): T => fn,
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
    const mockWhereClause = { AND: [{ environmentId: mockEnvironmentId }, {}] };

    beforeEach(() => {
      vi.mocked(prisma.segment.findMany).mockResolvedValue(
        mockSegmentsData as Prisma.Result<typeof prisma.segment, unknown, "findMany">
      );
      vi.mocked(segmentFilterToPrismaQuery).mockResolvedValue({
        ok: true,
        data: { whereClause: mockWhereClause },
      });
    });

    test("should return person segment IDs successfully", async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([{ id: mockContactId }, { id: mockContactId }]);

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
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockSegmentsData.map((s) => s.id));
    });

    test("should return empty array if no segments exist", async () => {
      vi.mocked(prisma.segment.findMany).mockResolvedValue([]);

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockDeviceType
      );

      expect(result).toEqual([]);
      expect(segmentFilterToPrismaQuery).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    test("should return empty array if segments exist but none match", async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([null, null]);

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockDeviceType
      );

      expect(result).toEqual([]);
      expect(segmentFilterToPrismaQuery).toHaveBeenCalledTimes(mockSegmentsData.length);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    test("should call validateInputs with correct parameters", async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([{ id: mockContactId }, { id: mockContactId }]);

      await getPersonSegmentIds(mockEnvironmentId, mockContactId, mockContactUserId, mockDeviceType);
      expect(validateInputs).toHaveBeenCalledWith(
        [mockEnvironmentId, expect.anything()],
        [mockContactId, expect.anything()],
        [mockContactUserId, expect.anything()]
      );
    });

    test("should return only matching segment IDs", async () => {
      vi.mocked(prisma.$transaction).mockResolvedValue([{ id: mockContactId }, null]);

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockDeviceType
      );

      expect(result).toEqual([mockSegmentsData[0].id]);
      expect(segmentFilterToPrismaQuery).toHaveBeenCalledTimes(mockSegmentsData.length);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    test("should include segments with no filters as always-matching", async () => {
      const segmentsWithEmptyFilters = [
        { id: "segment-no-filter", filters: [] },
        { id: "segment-with-filter", filters: [{}] as TBaseFilter[] },
      ];
      vi.mocked(prisma.segment.findMany).mockResolvedValue(
        segmentsWithEmptyFilters as Prisma.Result<typeof prisma.segment, unknown, "findMany">
      );
      vi.mocked(prisma.$transaction).mockResolvedValue([{ id: mockContactId }]);

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockDeviceType
      );

      expect(result).toContain("segment-no-filter");
      expect(result).toContain("segment-with-filter");
      expect(segmentFilterToPrismaQuery).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    test("should skip segments where filter query building fails", async () => {
      vi.mocked(segmentFilterToPrismaQuery)
        .mockResolvedValueOnce({
          ok: true,
          data: { whereClause: mockWhereClause },
        })
        .mockResolvedValueOnce({
          ok: false,
          error: { type: "bad_request", message: "Invalid filters", details: [] },
        });
      vi.mocked(prisma.$transaction).mockResolvedValue([{ id: mockContactId }]);

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockDeviceType
      );

      expect(result).toEqual(["segment1"]);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    test("should return empty array on unexpected error", async () => {
      vi.mocked(prisma.segment.findMany).mockRejectedValue(new Error("Unexpected"));

      const result = await getPersonSegmentIds(
        mockEnvironmentId,
        mockContactId,
        mockContactUserId,
        mockDeviceType
      );

      expect(result).toEqual([]);
    });
  });
});
