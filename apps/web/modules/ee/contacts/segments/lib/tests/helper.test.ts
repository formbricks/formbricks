import { checkForRecursiveSegmentFilter } from "@/modules/ee/contacts/segments/lib/helper";
import { getSegment } from "@/modules/ee/contacts/segments/lib/segments";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { TBaseFilters, TSegment } from "@formbricks/types/segment";

// Mock dependencies
vi.mock("@/modules/ee/contacts/segments/lib/segments", () => ({
  getSegment: vi.fn(),
}));

describe("checkForRecursiveSegmentFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should throw InvalidInputError when a filter references the same segment ID as the one being checked", async () => {
    // Arrange
    const segmentId = "segment-123";

    // Create a filter that references the same segment ID
    const filters = [
      {
        operator: "and",
        resource: {
          root: {
            type: "segment",
            segmentId, // This creates the recursive reference
          },
        },
      },
    ];

    // Act & Assert
    await expect(
      checkForRecursiveSegmentFilter(filters as unknown as TBaseFilters, segmentId)
    ).rejects.toThrow(new InvalidInputError("Recursive segment filter is not allowed"));

    // Verify that getSegment was not called since the function should throw before reaching that point
    expect(getSegment).not.toHaveBeenCalled();
  });

  test("should complete successfully when filters do not reference the same segment ID as the one being checked", async () => {
    // Arrange
    const segmentId = "segment-123";
    const differentSegmentId = "segment-456";

    // Create a filter that references a different segment ID
    const filters = [
      {
        operator: "and",
        resource: {
          root: {
            type: "segment",
            segmentId: differentSegmentId, // Different segment ID
          },
        },
      },
    ];

    // Mock the referenced segment to have non-recursive filters
    const referencedSegment = {
      id: differentSegmentId,
      filters: [
        {
          operator: "and",
          resource: {
            root: {
              type: "attribute",
              attributeClassName: "user",
              attributeKey: "email",
            },
            operator: "equals",
            value: "test@example.com",
          },
        },
      ],
    };

    vi.mocked(getSegment).mockResolvedValue(referencedSegment as unknown as TSegment);

    // Act & Assert
    // The function should complete without throwing an error
    await expect(
      checkForRecursiveSegmentFilter(filters as unknown as TBaseFilters, segmentId)
    ).resolves.toBeUndefined();

    // Verify that getSegment was called with the correct segment ID
    expect(getSegment).toHaveBeenCalledWith(differentSegmentId);
    expect(getSegment).toHaveBeenCalledTimes(1);
  });

  test("should recursively check nested filters for recursive references and throw InvalidInputError", async () => {
    // Arrange
    const originalSegmentId = "segment-123";
    const nestedSegmentId = "segment-456";

    // Create a filter that references another segment
    const filters = [
      {
        operator: "and",
        resource: {
          root: {
            type: "segment",
            segmentId: nestedSegmentId, // This references another segment
          },
        },
      },
    ];

    // Mock the nested segment to have a filter that references back to the original segment
    // This creates an indirect recursive reference
    vi.mocked(getSegment).mockResolvedValueOnce({
      id: nestedSegmentId,
      filters: [
        {
          operator: "and",
          resource: {
            root: {
              type: "segment",
              segmentId: originalSegmentId, // This creates the recursive reference back to the original segment
            },
          },
        },
      ],
    } as any);

    // Act & Assert
    await expect(
      checkForRecursiveSegmentFilter(filters as unknown as TBaseFilters, originalSegmentId)
    ).rejects.toThrow(new InvalidInputError("Recursive segment filter is not allowed"));

    // Verify that getSegment was called with the nested segment ID
    expect(getSegment).toHaveBeenCalledWith(nestedSegmentId);

    // Verify that getSegment was called exactly once
    expect(getSegment).toHaveBeenCalledTimes(1);
  });

  test("should detect circular references between multiple segments", async () => {
    // Arrange
    const segmentIdA = "segment-A";
    const segmentIdB = "segment-B";
    const segmentIdC = "segment-C";

    // Create filters for segment A that reference segment B
    const filtersA = [
      {
        operator: "and",
        resource: {
          root: {
            type: "segment",
            segmentId: segmentIdB, // A references B
          },
        },
      },
    ];

    // Create filters for segment B that reference segment C
    const filtersB = [
      {
        operator: "and",
        resource: {
          root: {
            type: "segment",
            segmentId: segmentIdC, // B references C
          },
        },
      },
    ];

    // Create filters for segment C that reference segment A (creating a circular reference)
    const filtersC = [
      {
        operator: "and",
        resource: {
          root: {
            type: "segment",
            segmentId: segmentIdA, // C references back to A, creating a circular reference
          },
        },
      },
    ];

    // Mock getSegment to return appropriate segment data for each segment ID
    vi.mocked(getSegment).mockImplementation(async (id) => {
      if (id === segmentIdB) {
        return { id: segmentIdB, filters: filtersB } as any;
      } else if (id === segmentIdC) {
        return { id: segmentIdC, filters: filtersC } as any;
      }
      return { id, filters: [] } as any;
    });

    // Act & Assert
    await expect(
      checkForRecursiveSegmentFilter(filtersA as unknown as TBaseFilters, segmentIdA)
    ).rejects.toThrow(new InvalidInputError("Recursive segment filter is not allowed"));

    // Verify that getSegment was called for segments B and C
    expect(getSegment).toHaveBeenCalledWith(segmentIdB);
    expect(getSegment).toHaveBeenCalledWith(segmentIdC);

    // Verify the number of calls to getSegment (should be 2)
    expect(getSegment).toHaveBeenCalledTimes(2);
  });
});
