import { describe, expect, it } from "vitest";
import { TBaseFilters } from "@formbricks/types/segment";
import { segmentFilterToPrismaQuery } from "../prisma-query";

describe("segmentFilterToPrismaQuery", () => {
  const environmentId = "env_12345";

  it("should generate a basic where clause for an empty filter", () => {
    const filters: TBaseFilters = [];
    const result = segmentFilterToPrismaQuery(filters, environmentId);

    expect(result.whereClause).toEqual({
      AND: [{ environmentId }, {}],
    });
  });

  it("should generate a where clause for a simple attribute filter with equals operator", () => {
    const filters: TBaseFilters = [
      {
        id: "filter_1",
        connector: null,
        resource: {
          id: "attr_1",
          root: {
            type: "attribute",
            contactAttributeKey: "email",
          },
          value: "test@example.com",
          qualifier: {
            operator: "equals",
          },
        },
      },
    ];

    const result = segmentFilterToPrismaQuery(filters, environmentId);

    expect(result.whereClause).toEqual({
      AND: [
        { environmentId },
        {
          attributes: {
            some: {
              attributeKey: {
                key: "email",
              },
              value: "test@example.com",
            },
          },
        },
      ],
    });
  });

  it("should generate a where clause for 'isSet' operator", () => {
    const filters: TBaseFilters = [
      {
        id: "filter_1",
        connector: null,
        resource: {
          id: "attr_1",
          root: {
            type: "attribute",
            contactAttributeKey: "email",
          },
          value: "",
          qualifier: {
            operator: "isSet",
          },
        },
      },
    ];

    const result = segmentFilterToPrismaQuery(filters, environmentId);

    expect(result.whereClause).toEqual({
      AND: [
        { environmentId },
        {
          attributes: {
            some: {
              attributeKey: {
                key: "email",
              },
            },
          },
        },
      ],
    });
  });

  it("should generate a where clause for 'isNotSet' operator", () => {
    const filters: TBaseFilters = [
      {
        id: "filter_1",
        connector: null,
        resource: {
          id: "attr_1",
          root: {
            type: "attribute",
            contactAttributeKey: "email",
          },
          value: "",
          qualifier: {
            operator: "isNotSet",
          },
        },
      },
    ];

    const result = segmentFilterToPrismaQuery(filters, environmentId);

    expect(result.whereClause).toEqual({
      AND: [
        { environmentId },
        {
          NOT: {
            attributes: {
              some: {
                attributeKey: {
                  key: "email",
                },
              },
            },
          },
        },
      ],
    });
  });

  it("should generate a where clause for a person filter", () => {
    const filters: TBaseFilters = [
      {
        id: "filter_1",
        connector: null,
        resource: {
          id: "person_1",
          root: {
            type: "person",
            personIdentifier: "userId",
          },
          value: "user_123",
          qualifier: {
            operator: "equals",
          },
        },
      },
    ];

    const result = segmentFilterToPrismaQuery(filters, environmentId);

    expect(result.whereClause).toEqual({
      AND: [
        { environmentId },
        {
          attributes: {
            some: {
              attributeKey: {
                key: "userId",
              },
              value: "user_123",
            },
          },
        },
      ],
    });
  });

  it("should generate a where clause with AND connector for multiple filters", () => {
    const filters: TBaseFilters = [
      {
        id: "filter_1",
        connector: "and",
        resource: {
          id: "attr_1",
          root: {
            type: "attribute",
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
        connector: null,
        resource: {
          id: "attr_2",
          root: {
            type: "attribute",
            contactAttributeKey: "name",
          },
          value: "John",
          qualifier: {
            operator: "contains",
          },
        },
      },
    ];

    const result = segmentFilterToPrismaQuery(filters, environmentId);

    expect(result.whereClause).toEqual({
      AND: [
        { environmentId },
        {
          AND: [
            {
              attributes: {
                some: {
                  attributeKey: {
                    key: "email",
                  },
                  value: "test@example.com",
                },
              },
            },
            {
              attributes: {
                some: {
                  attributeKey: {
                    key: "name",
                  },
                  value: {
                    contains: "John",
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        },
      ],
    });
  });

  it("should generate a where clause with OR connector for multiple filters", () => {
    const filters: TBaseFilters = [
      {
        id: "filter_1",
        connector: "or",
        resource: {
          id: "attr_1",
          root: {
            type: "attribute",
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
        connector: null,
        resource: {
          id: "attr_2",
          root: {
            type: "attribute",
            contactAttributeKey: "email",
          },
          value: "other@example.com",
          qualifier: {
            operator: "equals",
          },
        },
      },
    ];

    const result = segmentFilterToPrismaQuery(filters, environmentId);

    expect(result.whereClause).toEqual({
      AND: [
        { environmentId },
        {
          OR: [
            {
              attributes: {
                some: {
                  attributeKey: {
                    key: "email",
                  },
                  value: "test@example.com",
                },
              },
            },
            {
              attributes: {
                some: {
                  attributeKey: {
                    key: "email",
                  },
                  value: "other@example.com",
                },
              },
            },
          ],
        },
      ],
    });
  });

  it("should handle nested filter groups", () => {
    const filters: TBaseFilters = [
      {
        id: "group_1",
        connector: "and",
        resource: [
          {
            id: "filter_1",
            connector: "or",
            resource: {
              id: "attr_1",
              root: {
                type: "attribute",
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
            connector: null,
            resource: {
              id: "attr_2",
              root: {
                type: "attribute",
                contactAttributeKey: "email",
              },
              value: "other@example.com",
              qualifier: {
                operator: "equals",
              },
            },
          },
        ],
      },
      {
        id: "filter_3",
        connector: null,
        resource: {
          id: "attr_3",
          root: {
            type: "attribute",
            contactAttributeKey: "name",
          },
          value: "John",
          qualifier: {
            operator: "contains",
          },
        },
      },
    ];

    const result = segmentFilterToPrismaQuery(filters, environmentId);

    expect(result.whereClause).toEqual({
      AND: [
        { environmentId },
        {
          AND: [
            {
              OR: [
                {
                  attributes: {
                    some: {
                      attributeKey: {
                        key: "email",
                      },
                      value: "test@example.com",
                    },
                  },
                },
                {
                  attributes: {
                    some: {
                      attributeKey: {
                        key: "email",
                      },
                      value: "other@example.com",
                    },
                  },
                },
              ],
            },
            {
              attributes: {
                some: {
                  attributeKey: {
                    key: "name",
                  },
                  value: {
                    contains: "John",
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        },
      ],
    });
  });
});
