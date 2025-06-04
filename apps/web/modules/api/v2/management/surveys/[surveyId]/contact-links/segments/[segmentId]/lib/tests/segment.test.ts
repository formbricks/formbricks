import { Segment } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getSegment } from "../segment";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    segment: {
      findUnique: vi.fn(),
    },
  },
}));

describe("getSegment", () => {
  const mockSegmentId = "segment-123";
  const mockSegment: Pick<Segment, "id" | "environmentId" | "filters"> = {
    id: mockSegmentId,
    environmentId: "env-123",
    filters: [
      {
        id: "filter-123",
        connector: null,
        resource: {
          id: "attr_1",
          root: {
            type: "attribute",
            contactAttributeKey: "email",
          },
          value: "test@example.com",
          qualifier: { operator: "equals" },
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return segment data when segment is found", async () => {
    vi.mocked(prisma.segment.findUnique).mockResolvedValueOnce(mockSegment);

    const result = await getSegment(mockSegmentId);

    expect(prisma.segment.findUnique).toHaveBeenCalledWith({
      where: { id: mockSegmentId },
      select: {
        id: true,
        environmentId: true,
        filters: true,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(mockSegment);
    }
  });

  test("should return not_found error when segment doesn't exist", async () => {
    vi.mocked(prisma.segment.findUnique).mockResolvedValueOnce(null);

    const result = await getSegment(mockSegmentId);

    expect(prisma.segment.findUnique).toHaveBeenCalledWith({
      where: { id: mockSegmentId },
      select: {
        id: true,
        environmentId: true,
        filters: true,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        type: "not_found",
        details: [{ field: "segment", issue: "not found" }],
      });
    }
  });

  test("should return internal_server_error when database throws an error", async () => {
    const mockError = new Error("Database connection failed");
    vi.mocked(prisma.segment.findUnique).mockRejectedValueOnce(mockError);

    const result = await getSegment(mockSegmentId);

    expect(prisma.segment.findUnique).toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        type: "internal_server_error",
        details: [{ field: "segment", issue: "Database connection failed" }],
      });
    }
  });
});
