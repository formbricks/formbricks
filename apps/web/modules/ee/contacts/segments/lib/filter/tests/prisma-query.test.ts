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
      data: {
        whereClause: {
          AND: [{ environmentId: mockEnvironmentId }, {}],
        },
      },
      ok: true,
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

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.whereClause.AND?.[1]).toEqual({
        AND: [
          {
            attributes: {
              some: {
                attributeKey: { key: "email" },
                value: { equals: "test@example.com", mode: "insensitive" },
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
    }
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
                deviceType: "phone",
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

    if (result.ok) {
      const nestedConditionsAnd = result.data.whereClause.AND?.[1].AND?.[0].AND;
      const nestedConditionsOr = result.data.whereClause.AND?.[1].AND?.[0].OR;
      expect(nestedConditionsAnd).toContainEqual({
        attributes: {
          some: {
            attributeKey: { key: "email" },
            value: { equals: "test@example.com", mode: "insensitive" },
          },
        },
      });

      expect(nestedConditionsAnd).toContainEqual({
        attributes: {
          some: {
            attributeKey: { key: "userId" },
            value: { equals: "user123", mode: "insensitive" },
          },
        },
      });

      expect(nestedConditionsOr).toContainEqual({
        attributes: {
          some: {
            attributeKey: { key: "device" },
            value: { equals: "phone", mode: "insensitive" },
          },
        },
      });
    }
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

    if (result.ok) {
      expect(result.data.whereClause.AND?.[1]).toEqual({
        AND: [
          {
            attributes: {
              some: {
                attributeKey: { key: "email" },
                value: { equals: "test@example.com", mode: "insensitive" },
              },
            },
          },
          {
            AND: [
              {
                attributes: {
                  some: {
                    attributeKey: { key: "company" },
                    value: { equals: "Formbricks", mode: "insensitive" },
                  },
                },
              },
            ],
          },
        ],
      });
    }

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

    if (result.ok) {
      // The result should include the nested segment's filters
      expect(result.data.whereClause.AND?.[1]).toEqual({
        AND: [
          {
            AND: [
              {
                attributes: {
                  some: {
                    attributeKey: {
                      key: "company",
                    },
                    value: { equals: "Formbricks", mode: "insensitive" },
                  },
                },
              },
            ],
          },
        ],
      });
    }

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

    if (result.ok) {
      expect(result.data.whereClause.AND?.[1]).toEqual({});
    }
  });

  test("handle missing segments in segment filters", async () => {
    const nestedSegmentId = "segment-missing-123";

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

    if (result.ok) {
      expect(result.data.whereClause.AND?.[1]).toEqual({});
    }
  });

  test("complex test: combination of all operators and nested filters", async () => {
    // Create a nested segment
    const nestedSegmentId = "segment-nested-456";
    const nestedFilters: TBaseFilters = [
      {
        id: "nested_filter_1",
        connector: null,
        resource: {
          id: "nested_attr_1",
          root: {
            type: "attribute" as const,
            contactAttributeKey: "role",
          },
          value: "admin",
          qualifier: {
            operator: "equals",
          },
        },
      },
    ];

    // Mock the nested segment
    const mockNestedSegment: TSegment = {
      id: nestedSegmentId,
      filters: nestedFilters,
      environmentId: mockEnvironmentId,
      title: "Role Segment",
      description: null,
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      surveys: [],
    };

    vi.mocked(getSegment).mockResolvedValue(mockNestedSegment);

    // Complex filters combining multiple types and operators
    const filters: TBaseFilters = [
      {
        id: "group_1",
        connector: null,
        resource: [
          {
            id: "subgroup_1",
            connector: null,
            resource: [
              // Attribute with isNotSet operator
              {
                id: "filter_1",
                connector: null,
                resource: {
                  id: "attr_1",
                  root: {
                    type: "attribute" as const,
                    contactAttributeKey: "unsubscribedAt",
                  },
                  value: "",
                  qualifier: {
                    operator: "isNotSet",
                  },
                },
              },
              // Text comparison with endsWith
              {
                id: "filter_2",
                connector: "and",
                resource: {
                  id: "attr_2",
                  root: {
                    type: "attribute" as const,
                    contactAttributeKey: "email",
                  },
                  value: "example.com",
                  qualifier: {
                    operator: "endsWith",
                  },
                },
              },
              // Numeric comparison
              {
                id: "filter_3",
                connector: "and",
                resource: {
                  id: "attr_3",
                  root: {
                    type: "attribute" as const,
                    contactAttributeKey: "age",
                  },
                  value: 18,
                  qualifier: {
                    operator: "greaterEqual",
                  },
                },
              },
            ],
          },
          // Segment reference
          {
            id: "filter_4",
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
          // Device filter with notEquals
          {
            id: "filter_5",
            connector: "or",
            resource: {
              id: "device_1",
              root: {
                type: "device" as const,
                deviceType: "desktop",
              },
              value: "desktop",
              qualifier: {
                operator: "notEquals",
              },
            },
          },
          // Person filter
          {
            id: "filter_6",
            connector: "or",
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
          // Empty string test
          {
            id: "filter_7",
            connector: "and",
            resource: {
              id: "attr_4",
              root: {
                type: "attribute" as const,
                contactAttributeKey: "note",
              },
              value: "",
              qualifier: {
                operator: "equals",
              },
            },
          },
        ],
      },
    ];

    const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const whereClause = result.data.whereClause.AND?.[1];
      expect(whereClause).toBeDefined();

      // First group (AND conditions)
      const subgroup = whereClause.AND?.[0];
      expect(subgroup.AND[0].AND[0]).toStrictEqual({
        NOT: {
          attributes: {
            some: {
              attributeKey: { key: "unsubscribedAt" },
            },
          },
        },
      });

      expect(subgroup.AND[0].AND[1]).toStrictEqual({
        attributes: {
          some: {
            attributeKey: { key: "email" },
            value: { endsWith: "example.com", mode: "insensitive" },
          },
        },
      });

      expect(subgroup.AND[0].AND[2]).toStrictEqual({
        attributes: {
          some: {
            attributeKey: { key: "age" },
            value: { gte: "18" },
          },
        },
      });

      // Segment inclusion
      expect(whereClause.AND[0].AND[1].AND[0]).toStrictEqual({
        attributes: {
          some: {
            attributeKey: { key: "role" },
            value: { equals: "admin", mode: "insensitive" },
          },
        },
      });

      // Device filter (OR condition)
      expect(whereClause.AND[0].OR[0]).toStrictEqual({
        attributes: {
          some: {
            attributeKey: { key: "device" },
            value: { not: "desktop", mode: "insensitive" },
          },
        },
      });

      // Person filter (OR condition)
      expect(whereClause.AND[0].OR[1]).toStrictEqual({
        attributes: {
          some: {
            attributeKey: { key: "userId" },
            value: { equals: "user123", mode: "insensitive" },
          },
        },
      });

      // Empty string (AND condition)
      expect(whereClause.AND[0].AND[2]).toStrictEqual({
        attributes: {
          some: {
            attributeKey: { key: "note" },
            value: { equals: "", mode: "insensitive" },
          },
        },
      });
    }
  });

  test("complex test: error handling with edge cases", async () => {
    // Mock circular segment that also contains null values and malformed operators
    const circularSegmentId = "segment-circular-789";
    const circularFilters: TBaseFilters = [
      {
        id: "circular_filter_1",
        connector: null,
        resource: {
          id: "circular_segment_1",
          root: {
            type: "segment" as const,
            segmentId: circularSegmentId, // Self-reference
          },
          value: "",
          qualifier: {
            operator: "userIsIn",
          },
        },
      },
      {
        id: "circular_filter_2",
        connector: "and",
        resource: {
          id: "circular_attr_1",
          root: {
            type: "attribute" as const,
            contactAttributeKey: "status",
          },
          value: "null", // String "null" value
          qualifier: {
            operator: "invalidOperator" as any, // Invalid operator
          },
        },
      },
    ];

    // Mock a second segment that has a nested segment that doesn't exist
    const secondSegmentId = "segment-second-123";
    const secondFilters: TBaseFilters = [
      {
        id: "second_filter_1",
        connector: null,
        resource: {
          id: "second_segment_1",
          root: {
            type: "segment" as const,
            segmentId: "non-existent-segment", // Non-existent segment
          },
          value: "",
          qualifier: {
            operator: "userIsIn",
          },
        },
      },
      {
        id: "second_filter_2",
        connector: "and",
        resource: {
          id: "second_segment_2",
          root: {
            type: "attribute" as const,
            contactAttributeKey: "device",
          },
          value: "mobile",
          qualifier: {
            operator: "equals",
          },
        },
      },
    ];

    // Set up the mocks
    const mockCircularSegment: TSegment = {
      id: circularSegmentId,
      filters: circularFilters,
      environmentId: mockEnvironmentId,
      title: "Circular Segment",
      description: null,
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      surveys: [],
    };

    const mockSecondSegment: TSegment = {
      id: secondSegmentId,
      filters: secondFilters,
      environmentId: mockEnvironmentId,
      title: "Second Segment",
      description: null,
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      surveys: [],
    };

    // Set up the sequence of mock calls for different segments
    vi.mocked(getSegment)
      .mockResolvedValueOnce(mockCircularSegment) // First call for circularSegmentId
      .mockResolvedValueOnce(mockSecondSegment) // Third call for secondSegmentId
      .mockResolvedValueOnce(null as unknown as TSegment); // Fourth call for non-existent-segment

    // Complex filters with mixed error conditions
    const filters: TBaseFilters = [
      {
        id: "filter_1",
        connector: null,
        resource: {
          id: "segment_1",
          root: {
            type: "segment" as const,
            segmentId: circularSegmentId, // Will cause circular reference
          },
          value: "",
          qualifier: {
            operator: "userIsIn",
          },
        },
      },
      {
        id: "filter_2",
        connector: "and",
        resource: {
          id: "segment_2",
          root: {
            type: "segment" as const,
            segmentId: secondSegmentId, // Contains missing segment
          },
          value: "",
          qualifier: {
            operator: "userIsIn",
          },
        },
      },
      {
        id: "filter_3",
        connector: "and",
        resource: {
          id: "attr_1",
          root: {
            type: "device" as const, // Device type
            deviceType: "unknownValue", // Edge case device type
          },
          value: "unknownValue",
          qualifier: {
            operator: "equals",
          },
        },
      },
    ];

    const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      // The circularSegmentId should be detected as circular and return an empty object
      expect(result.data.whereClause.AND?.[1].AND[0].AND).toContainEqual({
        attributes: {
          some: {
            attributeKey: {
              key: "status",
            },
            value: "null",
          },
        },
      });

      // The device filter should still work
      expect(result.data.whereClause.AND?.[1].AND[2]).toStrictEqual({
        attributes: {
          some: {
            attributeKey: { key: "device" },
            value: { equals: "unknownValue", mode: "insensitive" },
          },
        },
      });
    }
  });

  test("complex test: advanced operators and multiple nesting levels", async () => {
    const filters: TBaseFilters = [
      {
        id: "group_1",
        connector: null,
        resource: [
          // First subgroup with various text operators
          {
            id: "subgroup_1",
            connector: null,
            resource: [
              {
                id: "nested_1",
                connector: null,
                resource: {
                  id: "attr_1",
                  root: {
                    type: "attribute" as const,
                    contactAttributeKey: "firstName",
                  },
                  value: "J",
                  qualifier: {
                    operator: "startsWith",
                  },
                },
              },
              {
                id: "nested_2",
                connector: "and",
                resource: {
                  id: "attr_2",
                  root: {
                    type: "attribute" as const,
                    contactAttributeKey: "lastName",
                  },
                  value: "son",
                  qualifier: {
                    operator: "endsWith",
                  },
                },
              },
              {
                id: "nested_3",
                connector: "and",
                resource: {
                  id: "attr_3",
                  root: {
                    type: "attribute" as const,
                    contactAttributeKey: "title",
                  },
                  value: "Manager",
                  qualifier: {
                    operator: "contains",
                  },
                },
              },
            ],
          },
          // Second subgroup with numeric operators
          {
            id: "subgroup_2",
            connector: "and",
            resource: [
              {
                id: "nested_4",
                connector: null,
                resource: {
                  id: "attr_4",
                  root: {
                    type: "attribute" as const,
                    contactAttributeKey: "loginCount",
                  },
                  value: 5,
                  qualifier: {
                    operator: "greaterThan",
                  },
                },
              },
              {
                id: "nested_5",
                connector: "and",
                resource: {
                  id: "attr_5",
                  root: {
                    type: "attribute" as const,
                    contactAttributeKey: "purchaseAmount",
                  },
                  value: 1000,
                  qualifier: {
                    operator: "lessEqual",
                  },
                },
              },
            ],
          },
          // Third subgroup with negation operators
          {
            id: "subgroup_3",
            connector: "or",
            resource: [
              {
                id: "nested_6",
                connector: null,
                resource: {
                  id: "attr_6",
                  root: {
                    type: "attribute" as const,
                    contactAttributeKey: "unsubscribedAt",
                  },
                  value: "",
                  qualifier: {
                    operator: "isNotSet",
                  },
                },
              },
              {
                id: "nested_7",
                connector: "or",
                resource: {
                  id: "attr_7",
                  root: {
                    type: "attribute" as const,
                    contactAttributeKey: "company",
                  },
                  value: "Competitor Inc",
                  qualifier: {
                    operator: "notEquals",
                  },
                },
              },
              {
                id: "nested_8",
                connector: "or",
                resource: {
                  id: "attr_8",
                  root: {
                    type: "attribute" as const,
                    contactAttributeKey: "interests",
                  },
                  value: "Spam",
                  qualifier: {
                    operator: "doesNotContain",
                  },
                },
              },
            ],
          },
        ],
      },
    ];

    const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const whereClause = result.data.whereClause.AND?.[1];

      // First subgroup (text operators)
      const firstSubgroup = whereClause.AND?.[0];
      expect(firstSubgroup.AND[0].AND).toContainEqual({
        attributes: {
          some: {
            attributeKey: { key: "firstName" },
            value: { startsWith: "J", mode: "insensitive" },
          },
        },
      });
      expect(firstSubgroup.AND[0].AND).toContainEqual({
        attributes: {
          some: {
            attributeKey: { key: "lastName" },
            value: { endsWith: "son", mode: "insensitive" },
          },
        },
      });

      expect(firstSubgroup.AND[0].AND).toContainEqual({
        attributes: {
          some: {
            attributeKey: { key: "title" },
            value: { contains: "Manager", mode: "insensitive" },
          },
        },
      });

      // Second subgroup (numeric operators)
      const secondSubgroup = whereClause.AND?.[0];
      expect(secondSubgroup.AND[1].AND).toContainEqual({
        attributes: {
          some: {
            attributeKey: { key: "loginCount" },
            value: { gt: "5" },
          },
        },
      });

      expect(secondSubgroup.AND[1].AND).toContainEqual({
        attributes: {
          some: {
            attributeKey: { key: "purchaseAmount" },
            value: { lte: "1000" },
          },
        },
      });

      // Third subgroup (negation operators in OR clause)
      const thirdSubgroup = whereClause.AND?.[0];
      expect(thirdSubgroup.OR[0].OR).toContainEqual({
        NOT: {
          attributes: {
            some: {
              attributeKey: { key: "unsubscribedAt" },
            },
          },
        },
      });

      expect(thirdSubgroup.OR[0].OR).toContainEqual({
        attributes: {
          some: {
            attributeKey: { key: "company" },
            value: { not: "Competitor Inc", mode: "insensitive" },
          },
        },
      });

      expect(thirdSubgroup.OR[0].OR).toContainEqual({
        attributes: {
          some: {
            attributeKey: { key: "interests" },
            value: { not: { contains: "Spam" }, mode: "insensitive" },
          },
        },
      });
    }
  });
});
