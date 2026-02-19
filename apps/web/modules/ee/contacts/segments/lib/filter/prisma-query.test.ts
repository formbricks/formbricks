import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { TBaseFilters, TSegmentWithSurveyNames } from "@formbricks/types/segment";
import { getSegment } from "../segments";
import { segmentFilterToPrismaQuery } from "./prisma-query";

const mockQueryRawUnsafe = vi.fn();
const mockFindFirst = vi.fn();

vi.mock("@formbricks/database", () => ({
  prisma: {
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
    contactAttribute: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

vi.mock("../segments", () => ({
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
    // Default: backfill is complete, no un-migrated rows
    mockFindFirst.mockResolvedValue(null);
    // Fallback path mock: raw SQL returns one matching contact when un-migrated rows exist
    mockQueryRawUnsafe.mockResolvedValue([{ contactId: "mock-contact-1" }]);
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
                valueNumber: { gt: 30 },
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
      const whereClause = result.data.whereClause as Prisma.ContactWhereInput as any;
      const nestedConditionsAnd = whereClause.AND?.[1].AND?.[0].AND;
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

      // Note: Device filters are evaluated at runtime (from User-Agent), not as database queries.
      // When no deviceType is provided to segmentFilterToPrismaQuery, device filters return empty constraint.
      // The OR clause will be empty or not present since device filter returns {}.
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
    const mockSegment: TSegmentWithSurveyNames = {
      id: nestedSegmentId,
      filters: nestedFilters,
      environmentId: mockEnvironmentId,
      title: "Test Segment",
      description: null,
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      surveys: [],
      activeSurveys: [],
      inactiveSurveys: [],
    };

    vi.mocked(getSegment).mockResolvedValue(mockSegment);

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
    vi.mocked(getSegment).mockResolvedValueOnce(mockSegment);
    vi.mocked(getSegment).mockResolvedValueOnce(null as unknown as TSegmentWithSurveyNames);

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
    // Test with a segment filter that will call getSegment and throw
    const filters: TBaseFilters = [
      {
        id: "filter_1",
        connector: null,
        resource: {
          id: "segment_1",
          root: {
            type: "segment" as const,
            segmentId: "failing-segment-id",
          },
          value: "",
          qualifier: {
            operator: "userIsIn",
          },
        },
      },
    ];

    // Mock getSegment to throw an error
    vi.mocked(getSegment).mockRejectedValueOnce(error);

    const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result.error as any).type).toBe("bad_request");
      expect((result.error as any).message).toBe("Failed to convert segment filters to Prisma query");
    }
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
    const mockSegment: TSegmentWithSurveyNames = {
      id: nestedSegmentId,
      filters: nestedFilters,
      environmentId: mockEnvironmentId,
      title: "Test Segment",
      description: null,
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      surveys: [],
      activeSurveys: [],
      inactiveSurveys: [],
    };

    vi.mocked(getSegment).mockResolvedValue(mockSegment);

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
    const circularSegment: TSegmentWithSurveyNames = {
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
      activeSurveys: [],
      inactiveSurveys: [],
    };

    vi.mocked(getSegment).mockResolvedValue(circularSegment);

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

    vi.mocked(getSegment).mockResolvedValue(null as unknown as TSegmentWithSurveyNames);

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
    const mockNestedSegment: TSegmentWithSurveyNames = {
      id: nestedSegmentId,
      filters: nestedFilters,
      environmentId: mockEnvironmentId,
      title: "Role Segment",
      description: null,
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      surveys: [],
      activeSurveys: [],
      inactiveSurveys: [],
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
      const whereClause = (result.data.whereClause as Prisma.ContactWhereInput).AND?.[1] as any;
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
            valueNumber: { gte: 18 },
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

      // Note: Device filters are evaluated at runtime (from User-Agent), not as database queries.
      // When no deviceType is provided to segmentFilterToPrismaQuery, device filters return empty constraint.
      // So we check the person filter which should be in OR[0] since device filter is skipped.

      // Person filter (OR condition) - device filter returns {} so person filter is at OR[0]
      expect(whereClause.AND[0].OR[0]).toStrictEqual({
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
    const mockCircularSegment: TSegmentWithSurveyNames = {
      id: circularSegmentId,
      filters: circularFilters,
      environmentId: mockEnvironmentId,
      title: "Circular Segment",
      description: null,
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      surveys: [],
      activeSurveys: [],
      inactiveSurveys: [],
    };

    const mockSecondSegment: TSegmentWithSurveyNames = {
      id: secondSegmentId,
      filters: secondFilters,
      environmentId: mockEnvironmentId,
      title: "Second Segment",
      description: null,
      isPrivate: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      surveys: [],
      activeSurveys: [],
      inactiveSurveys: [],
    };

    // Set up the sequence of mock calls for different segments
    vi.mocked(getSegment)
      .mockResolvedValueOnce(mockCircularSegment) // First call for circularSegmentId
      .mockResolvedValueOnce(mockSecondSegment) // Third call for secondSegmentId
      .mockResolvedValueOnce(null as unknown as TSegmentWithSurveyNames); // Fourth call for non-existent-segment

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
      const whereClause = result.data.whereClause as Prisma.ContactWhereInput as any;
      // The circularSegmentId should be detected as circular and return an empty object
      expect(whereClause.AND?.[1].AND[0].AND).toContainEqual({
        attributes: {
          some: {
            attributeKey: {
              key: "status",
            },
            value: "null",
          },
        },
      });

      // Note: Device filters are evaluated at runtime (from User-Agent), not as database queries.
      // When no deviceType is provided to segmentFilterToPrismaQuery, device filters return empty constraint.
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
      const whereClause = (result.data.whereClause as Prisma.ContactWhereInput as any).AND?.[1];

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

      // Second subgroup (numeric operators - uses clean Prisma filter post-backfill)
      const secondSubgroup = whereClause.AND?.[0];
      expect(secondSubgroup.AND[1].AND).toContainEqual({
        attributes: {
          some: {
            attributeKey: { key: "loginCount" },
            valueNumber: { gt: 5 },
          },
        },
      });
      expect(secondSubgroup.AND[1].AND).toContainEqual({
        attributes: {
          some: {
            attributeKey: { key: "purchaseAmount" },
            valueNumber: { lte: 1000 },
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

  // ==========================================
  // DATE FILTER TESTS
  // ==========================================

  describe("date attribute filters", () => {
    test("handle isBefore date operator", async () => {
      const targetDate = "2024-06-15";
      const filters: TBaseFilters = [
        {
          id: "filter_1",
          connector: null,
          resource: {
            id: "attr_1",
            root: {
              type: "attribute" as const,
              contactAttributeKey: "purchaseDate",
            },
            value: targetDate,
            qualifier: {
              operator: "isBefore",
            },
          },
        },
      ];

      const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const whereClause = result.data.whereClause as Prisma.ContactWhereInput;
        const filterClause = (whereClause.AND as Prisma.ContactWhereInput[])?.[1];
        expect(filterClause).toEqual({
          AND: [
            {
              attributes: {
                some: {
                  attributeKey: { key: "purchaseDate", dataType: "date" },
                  OR: [
                    { valueDate: { lt: new Date(targetDate) } },
                    { valueDate: null, value: { lt: new Date(targetDate).toISOString() } },
                  ],
                },
              },
            },
          ],
        });
      }
    });

    test("handle isAfter date operator", async () => {
      const targetDate = "2024-01-01";
      const filters: TBaseFilters = [
        {
          id: "filter_1",
          connector: null,
          resource: {
            id: "attr_1",
            root: {
              type: "attribute" as const,
              contactAttributeKey: "signupDate",
            },
            value: targetDate,
            qualifier: {
              operator: "isAfter",
            },
          },
        },
      ];

      const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const whereClause = result.data.whereClause as Prisma.ContactWhereInput;
        const filterClause = (whereClause.AND as Prisma.ContactWhereInput[])?.[1];
        expect(filterClause).toEqual({
          AND: [
            {
              attributes: {
                some: {
                  attributeKey: { key: "signupDate", dataType: "date" },
                  OR: [
                    { valueDate: { gt: new Date(targetDate) } },
                    { valueDate: null, value: { gt: new Date(targetDate).toISOString() } },
                  ],
                },
              },
            },
          ],
        });
      }
    });

    test("handle isBetween date operator", async () => {
      const startDate = "2024-01-01";
      const endDate = "2024-12-31";
      const filters: TBaseFilters = [
        {
          id: "filter_1",
          connector: null,
          resource: {
            id: "attr_1",
            root: {
              type: "attribute" as const,
              contactAttributeKey: "lastActivityDate",
            },
            value: [startDate, endDate],
            qualifier: {
              operator: "isBetween",
            },
          },
        },
      ];

      const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const whereClause = result.data.whereClause as Prisma.ContactWhereInput;
        const filterClause = (whereClause.AND as Prisma.ContactWhereInput[])?.[1];
        expect(filterClause).toEqual({
          AND: [
            {
              attributes: {
                some: {
                  attributeKey: { key: "lastActivityDate", dataType: "date" },
                  OR: [
                    { valueDate: { gte: new Date(startDate), lte: new Date(endDate) } },
                    {
                      valueDate: null,
                      value: {
                        gte: new Date(startDate).toISOString(),
                        lte: new Date(endDate).toISOString(),
                      },
                    },
                  ],
                },
              },
            },
          ],
        });
      }
    });

    test("handle isSameDay date operator", async () => {
      const targetDate = "2024-07-04";
      const filters: TBaseFilters = [
        {
          id: "filter_1",
          connector: null,
          resource: {
            id: "attr_1",
            root: {
              type: "attribute" as const,
              contactAttributeKey: "eventDate",
            },
            value: targetDate,
            qualifier: {
              operator: "isSameDay",
            },
          },
        },
      ];

      const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const whereClause = result.data.whereClause as Prisma.ContactWhereInput;
        const filterClause = (whereClause.AND as Prisma.ContactWhereInput[])?.[1];
        // isSameDay should generate OR with valueDate and string fallback
        const dateAttr = (filterClause as unknown as any)?.AND?.[0]?.attributes;
        expect(dateAttr).toBeDefined();
        const orConditions = dateAttr?.some?.OR;
        expect(orConditions).toHaveLength(2);
        const valueDate = orConditions?.[0]?.valueDate;
        expect(valueDate).toHaveProperty("gte");
        expect(valueDate).toHaveProperty("lte");
        // Verify the date range is for the same day
        const gteDate = valueDate.gte as Date;
        const lteDate = valueDate.lte as Date;
        expect(gteDate.getUTCFullYear()).toBe(2024);
        expect(gteDate.getUTCMonth()).toBe(6); // July is month 6 (0-indexed)
        expect(gteDate.getUTCDate()).toBe(4);
        expect(gteDate.getUTCHours()).toBe(0);
        expect(gteDate.getUTCMinutes()).toBe(0);
        expect(lteDate.getUTCFullYear()).toBe(2024);
        expect(lteDate.getUTCMonth()).toBe(6);
        expect(lteDate.getUTCDate()).toBe(4);
        expect(lteDate.getUTCHours()).toBe(23);
        expect(lteDate.getUTCMinutes()).toBe(59);
      }
    });

    test("handle isOlderThan date operator with days unit", async () => {
      const filters: TBaseFilters = [
        {
          id: "filter_1",
          connector: null,
          resource: {
            id: "attr_1",
            root: {
              type: "attribute" as const,
              contactAttributeKey: "accountCreatedAt",
            },
            value: { amount: 30, unit: "days" },
            qualifier: {
              operator: "isOlderThan",
            },
          },
        },
      ];

      const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const whereClause = result.data.whereClause as Prisma.ContactWhereInput;
        const filterClause = (whereClause.AND as Prisma.ContactWhereInput[])?.[1];
        const dateAttr = (filterClause as unknown as any)?.AND?.[0]?.attributes;
        expect(dateAttr).toBeDefined();
        const orConditions = dateAttr?.some?.OR;
        expect(orConditions).toHaveLength(2);
        const valueDate = orConditions?.[0]?.valueDate;
        expect(valueDate).toHaveProperty("lt");
        // The threshold should be approximately 30 days ago
        const threshold = valueDate.lt as Date;
        const now = new Date();
        const diffMs = now.getTime() - threshold.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        // Allow some tolerance for test execution time
        expect(diffDays).toBeGreaterThanOrEqual(29.9);
        expect(diffDays).toBeLessThanOrEqual(30.1);
      }
    });

    test("handle isNewerThan date operator with weeks unit", async () => {
      const filters: TBaseFilters = [
        {
          id: "filter_1",
          connector: null,
          resource: {
            id: "attr_1",
            root: {
              type: "attribute" as const,
              contactAttributeKey: "lastPurchaseDate",
            },
            value: { amount: 2, unit: "weeks" },
            qualifier: {
              operator: "isNewerThan",
            },
          },
        },
      ];

      const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const whereClause = result.data.whereClause as Prisma.ContactWhereInput;
        const filterClause = (whereClause.AND as Prisma.ContactWhereInput[])?.[1];
        const dateAttr = (filterClause as unknown as any)?.AND?.[0]?.attributes;
        expect(dateAttr).toBeDefined();
        const orConditions = dateAttr?.some?.OR;
        expect(orConditions).toHaveLength(2);
        const valueDate = orConditions?.[0]?.valueDate;
        expect(valueDate).toHaveProperty("gte");
        // The threshold should be approximately 2 weeks (14 days) ago
        const threshold = valueDate.gte as Date;
        const now = new Date();
        const diffMs = now.getTime() - threshold.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        expect(diffDays).toBeGreaterThanOrEqual(13.9);
        expect(diffDays).toBeLessThanOrEqual(14.1);
      }
    });

    test("handle isOlderThan date operator with months unit", async () => {
      const filters: TBaseFilters = [
        {
          id: "filter_1",
          connector: null,
          resource: {
            id: "attr_1",
            root: {
              type: "attribute" as const,
              contactAttributeKey: "subscriptionStartDate",
            },
            value: { amount: 6, unit: "months" },
            qualifier: {
              operator: "isOlderThan",
            },
          },
        },
      ];

      const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const whereClause = result.data.whereClause as Prisma.ContactWhereInput;
        const filterClause = (whereClause.AND as Prisma.ContactWhereInput[])?.[1];
        const dateAttr = (filterClause as unknown as any)?.AND?.[0]?.attributes;
        expect(dateAttr).toBeDefined();
        const orConditions = dateAttr?.some?.OR;
        expect(orConditions).toHaveLength(2);
        const valueDate = orConditions?.[0]?.valueDate;
        expect(valueDate).toHaveProperty("lt");
        // The threshold should be approximately 6 months ago
        const threshold = valueDate.lt as Date;
        const now = new Date();
        // Calculate expected threshold (approximately 6 months ago)
        const expectedThreshold = new Date(now);
        expectedThreshold.setMonth(expectedThreshold.getMonth() - 6);
        // Allow 2 day tolerance for month boundary differences
        const diffMs = Math.abs(threshold.getTime() - expectedThreshold.getTime());
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        expect(diffDays).toBeLessThanOrEqual(2);
      }
    });

    test("handle multiple date filters with AND connector", async () => {
      const filters: TBaseFilters = [
        {
          id: "filter_1",
          connector: null,
          resource: {
            id: "attr_1",
            root: {
              type: "attribute" as const,
              contactAttributeKey: "signupDate",
            },
            value: "2024-01-01",
            qualifier: {
              operator: "isAfter",
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
              contactAttributeKey: "lastActivityDate",
            },
            value: { amount: 7, unit: "days" },
            qualifier: {
              operator: "isNewerThan",
            },
          },
        },
      ];

      const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const whereClause = result.data.whereClause as Prisma.ContactWhereInput;
        const filterClause = (whereClause.AND as Prisma.ContactWhereInput[])?.[1];
        const andConditions = (filterClause as unknown as any).AND as Prisma.ContactWhereInput[];
        expect(andConditions).toHaveLength(2);

        // First filter: isAfter (with OR fallback for transition)
        const firstFilter = andConditions[0] as unknown as any;
        expect(firstFilter.attributes.some.attributeKey.key).toBe("signupDate");
        expect(firstFilter.attributes.some.OR[0].valueDate.gt).toEqual(new Date("2024-01-01"));
        expect(firstFilter.attributes.some.OR[1].valueDate).toBeNull();
        expect(firstFilter.attributes.some.OR[1].value.gt).toBe(new Date("2024-01-01").toISOString());

        // Second filter: isNewerThan (with OR fallback for transition)
        const secondFilter = andConditions[1] as unknown as any;
        expect(secondFilter.attributes.some.attributeKey.key).toBe("lastActivityDate");
        expect(secondFilter.attributes.some.OR[0].valueDate).toHaveProperty("gte");
      }
    });

    test("handle date filter combined with string and number filters", async () => {
      const filters: TBaseFilters = [
        {
          id: "filter_1",
          connector: null,
          resource: {
            id: "attr_1",
            root: {
              type: "attribute" as const,
              contactAttributeKey: "plan",
            },
            value: "premium",
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
              contactAttributeKey: "purchaseCount",
            },
            value: 5,
            qualifier: {
              operator: "greaterThan",
            },
          },
        },
        {
          id: "filter_3",
          connector: "and",
          resource: {
            id: "attr_3",
            root: {
              type: "attribute" as const,
              contactAttributeKey: "lastPurchaseDate",
            },
            value: { amount: 30, unit: "days" },
            qualifier: {
              operator: "isNewerThan",
            },
          },
        },
      ];

      const result = await segmentFilterToPrismaQuery(mockSegmentId, filters, mockEnvironmentId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const whereClause = result.data.whereClause as Prisma.ContactWhereInput;
        const filterClause = (whereClause.AND as Prisma.ContactWhereInput[])?.[1];
        const andConditions = (filterClause as unknown as any).AND as Prisma.ContactWhereInput[];
        expect(andConditions).toHaveLength(3);

        // String filter uses 'value'
        expect((andConditions[0] as unknown as any).attributes.some.value).toEqual({
          equals: "premium",
          mode: "insensitive",
        });

        // Number filter uses clean Prisma filter post-backfill
        expect(andConditions[1]).toEqual({
          attributes: {
            some: {
              attributeKey: { key: "purchaseCount" },
              valueNumber: { gt: 5 },
            },
          },
        });

        // Date filter uses OR fallback with 'valueDate' and string 'value'
        expect((andConditions[2] as unknown as any).attributes.some.OR[0].valueDate).toHaveProperty("gte");
      }
    });
  });
});
