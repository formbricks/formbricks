import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cache } from "@formbricks/lib/cache";
import { TBaseFilters, TSegment } from "@formbricks/types/segment";
import { getSegment } from "../../segments";
import { segmentFilterToPrismaQuery } from "../prisma-query";

// Mock dependencies
vi.mock("@formbricks/lib/cache", () => ({
  cache: vi.fn((fn) => fn),
}));

vi.mock("../../segments", () => ({
  getSegment: vi.fn(),
}));

vi.mock("react", () => ({
  cache: (fn) => fn,
}));

describe("segmentFilterToPrismaQuery", () => {
  const mockSegmentId = "segment-123";
  const mockEnvironmentId = "env-456";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  test("generate a basic where clause for an empty filter", async () => {
    const filters: TBaseFilters = [];

    const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

    expect(result).toEqual({
      whereClause: {
        AND: [{ environmentId: mockEnvironmentId }, {}],
      },
    });
  });

  test("handle complex filters with multiple attribute operators", async () => {
    const filters: TBaseFilters = [
      {
        id: "filter_1",
        connector: null,
        resource: {
          id: "attr_1",
          root: {
            type: "attribute" as const,
            contactAttributeKey: "email",
          },
          value: "test@example.com",
          qualifier: {
            operator: "equals",
          },
        },
      },
      {
        id: "filter_2",
        connector: "and",
        resource: {
          id: "attr_2",
          root: {
            type: "attribute" as const,
            contactAttributeKey: "name",
          },
          value: "John",
          qualifier: {
            operator: "contains",
          },
        },
      },
      {
        id: "filter_3",
        connector: "or",
        resource: {
          id: "attr_3",
          root: {
            type: "attribute" as const,
            contactAttributeKey: "age",
          },
          value: 30,
          qualifier: {
            operator: "greaterThan",
          },
        },
      },
      {
        id: "filter_4",
        connector: "and",
        resource: {
          id: "attr_4",
          root: {
            type: "attribute" as const,
            contactAttributeKey: "company",
          },
          value: "",
          qualifier: {
            operator: "isSet",
          },
        },
      },
    ];

    const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

    // Verify the structure with multiple conditions
    expect(result.whereClause.AND?.[1]).toEqual({
      AND: [
        {
          attributes: {
            some: {
              attributeKey: { key: "email" },
              value: "test@example.com",
            },
          },
        },
        {
          attributes: {
            some: {
              attributeKey: { key: "name" },
              value: { contains: "John", mode: "insensitive" },
            },
          },
        },
        {
          attributes: {
            some: {
              attributeKey: {
                key: "company",
              },
            },
          },
        },
      ],
      OR: [
        {
          attributes: {
            some: {
              attributeKey: { key: "age" },
              value: { gt: "30" },
            },
          },
        },
      ],
    });
  });

  test("should handle nested filters with different types (attribute, person, device)", async () => {
    const filters: TBaseFilters = [
      {
        id: "group_1",
        connector: null,
        resource: [
          {
            id: "nested_1",
            connector: null,
            resource: {
              id: "attr_1",
              root: {
                type: "attribute" as const,
                contactAttributeKey: "email",
              },
              value: "test@example.com",
              qualifier: {
                operator: "equals",
              },
            },
          },
          {
            id: "nested_2",
            connector: "and",
            resource: {
              id: "person_1",
              root: {
                type: "person" as const,
                personIdentifier: "userId",
              },
              value: "user123",
              qualifier: {
                operator: "equals",
              },
            },
          },
          {
            id: "nested_3",
            connector: "or",
            resource: {
              id: "device_1",
              root: {
                type: "device" as const,
                deviceType: "deviceType",
              },
              value: "phone",
              qualifier: {
                operator: "equals",
              },
            },
          },
        ],
      },
    ];

    const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

    const nestedConditionsAnd = result.whereClause.AND?.[1].AND?.[0].AND;
    const nestedConditionsOr = result.whereClause.AND?.[1].AND?.[0].OR;
    expect(nestedConditionsAnd).toContainEqual({
      attributes: {
        some: {
          attributeKey: { key: "email" },
          value: "test@example.com",
        },
      },
    });

    expect(nestedConditionsAnd).toContainEqual({
      attributes: {
        some: {
          attributeKey: { key: "userId" },
          value: "user123",
        },
      },
    });

    expect(nestedConditionsOr).toContainEqual({
      attributes: {
        some: {
          attributeKey: { key: "device" },
          value: "phone",
        },
      },
    });
  });

  test("handle segment filters with nested segments and error cases", async () => {
    const nestedSegmentId = "segment-nested-123";
    const nestedFilters: TBaseFilters = [
      {
        id: "filter_nested_1",
        connector: null,
        resource: {
          id: "attr_nested_1",
          root: {
            type: "attribute" as const,
            contactAttributeKey: "company",
          },
          value: "Formbricks",
          qualifier: {
            operator: "equals",
          },
        },
      },
    ];

    // Mock the getSegment function to return a segment with filters
    const mockSegment: Partial<TSegment> = {
      id: nestedSegmentId,
      filters: nestedFilters,
      environmentId: mockEnvironmentId,
      title: "Test Segment",
      description: null,
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      surveys: [],
    };

    vi.mocked(getSegment).mockResolvedValue(mockSegment as TSegment);

    const filters: TBaseFilters = [
      {
        id: "filter_1",
        connector: null,
        resource: {
          id: "attr_1",
          root: {
            type: "attribute" as const,
            contactAttributeKey: "email",
          },
          value: "test@example.com",
          qualifier: {
            operator: "equals",
          },
        },
      },
      {
        id: "filter_2",
        connector: "and",
        resource: {
          id: "segment_1",
          root: {
            type: "segment" as const,
            segmentId: nestedSegmentId,
          },
          value: "",
          qualifier: {
            operator: "userIsIn",
          },
        },
      },
      {
        id: "filter_3",
        connector: "or",
        resource: {
          id: "segment_2",
          root: {
            type: "segment" as const,
            segmentId: "non-existent-segment",
          },
          value: "",
          qualifier: {
            operator: "userIsIn",
          },
        },
      },
    ];

    // Mock getSegment to return null for the non-existent segment
    vi.mocked(getSegment).mockResolvedValueOnce(mockSegment as TSegment);
    vi.mocked(getSegment).mockResolvedValueOnce(null as unknown as TSegment);

    const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

    // Verify the structure with both successful and failed segment filters
    expect(result.whereClause.AND?.[1]).toEqual({
      AND: [
        {
          attributes: {
            some: {
              attributeKey: { key: "email" },
              value: "test@example.com",
            },
          },
        },
        {
          AND: [
            {
              attributes: {
                some: {
                  attributeKey: { key: "company" },
                  value: "Formbricks",
                },
              },
            },
          ],
        },
      ],
    });

    // Verify getSegment was called with both segment IDs
    expect(getSegment).toHaveBeenCalledWith(nestedSegmentId);
    expect(getSegment).toHaveBeenCalledWith("non-existent-segment");
  });

  test("handle errors and rethrow them", async () => {
    const error = new Error("Test error");

    vi.mocked(cache).mockImplementationOnce(() => {
      throw error;
    });

    const filters: TBaseFilters = [];

    await expect(segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId)).rejects.toThrow(
      "Test error"
    );
  });

  test("generate a where clause for a segment filter", async () => {
    const nestedSegmentId = "segment-nested-123";
    const nestedFilters: TBaseFilters = [
      {
        id: "filter_nested_1",
        connector: null,
        resource: {
          id: "attr_nested_1",
          root: {
            type: "attribute" as const,
            contactAttributeKey: "company",
          },
          value: "Formbricks",
          qualifier: {
            operator: "equals",
          },
        },
      },
    ];

    // Mock the getSegment function to return a segment with filters
    const mockSegment: Partial<TSegment> = {
      id: nestedSegmentId,
      filters: nestedFilters,
      environmentId: mockEnvironmentId,
      title: "Test Segment",
      description: null,
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      surveys: [],
    };

    vi.mocked(getSegment).mockResolvedValue(mockSegment as TSegment);

    const filters: TBaseFilters = [
      {
        id: "filter_1",
        connector: null,
        resource: {
          id: "segment_1",
          root: {
            type: "segment",
            segmentId: nestedSegmentId,
          },
          value: "", // value doesn't matter for segment filters
          qualifier: {
            operator: "userIsIn", // operator doesn't matter for segment filters
          },
        },
      },
    ];

    const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

    // The result should include the nested segment's filters
    expect(result.whereClause.AND?.[1]).toEqual({
      AND: [
        {
          AND: [
            {
              attributes: {
                some: {
                  attributeKey: {
                    key: "company",
                  },
                  value: "Formbricks",
                },
              },
            },
          ],
        },
      ],
    });

    // Verify getSegment was called with the correct ID
    expect(getSegment).toHaveBeenCalledWith(nestedSegmentId);
  });

  test("handle circular references in segment filters", async () => {
    // Mock getSegment to simulate a circular reference
    const circularSegment: Partial<TSegment> = {
      id: mockSegmentId, // Same ID creates the circular reference
      filters: [
        {
          id: "filter_1",
          connector: null,
          resource: {
            id: "segment_1",
            root: {
              type: "segment" as const,
              segmentId: mockSegmentId, // Circular reference
            },
            value: "",
            qualifier: {
              operator: "userIsIn",
            },
          },
        },
      ],
      environmentId: mockEnvironmentId,
      title: "Circular Segment",
      description: null,
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      surveys: [],
    };

    vi.mocked(getSegment).mockResolvedValue(circularSegment as TSegment);

    const filters: TBaseFilters = [
      {
        id: "filter_1",
        connector: null,
        resource: {
          id: "segment_1",
          root: {
            type: "segment" as const,
            segmentId: mockSegmentId, // Circular reference
          },
          value: "",
          qualifier: {
            operator: "userIsIn",
          },
        },
      },
    ];

    const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

    // The result should be an empty where clause since circular references return {}
    expect(result.whereClause.AND?.[1]).toEqual({});
  });

  test("handle missing segments in segment filters", async () => {
    const nestedSegmentId = "segment-missing-123";

    // Mock getSegment to return null (segment not found)
    vi.mocked(getSegment).mockResolvedValue(null as unknown as TSegment);

    const filters: TBaseFilters = [
      {
        id: "filter_1",
        connector: null,
        resource: {
          id: "segment_1",
          root: {
            type: "segment" as const,
            segmentId: nestedSegmentId,
          },
          value: "",
          qualifier: {
            operator: "userIsIn",
          },
        },
      },
    ];

    const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

    expect(result.whereClause.AND?.[1]).toEqual({});
  });
});
