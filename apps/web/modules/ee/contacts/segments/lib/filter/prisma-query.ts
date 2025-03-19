import { isResourceFilter } from "@/modules/ee/contacts/segments/lib/utils";
import { Prisma } from "@prisma/client";
import {
  TBaseFilters,
  TSegmentAttributeFilter,
  TSegmentConnector,
  TSegmentDeviceFilter,
  TSegmentFilter,
  TSegmentPersonFilter,
} from "@formbricks/types/segment";

// Type for the result of the segment filter to prisma query generation
export type SegmentFilterQueryResult = {
  whereClause: Prisma.ContactWhereInput;
};

/**
 * Builds a Prisma where clause from a segment attribute filter
 */
const buildAttributeFilterWhereClause = (filter: TSegmentAttributeFilter): Prisma.ContactWhereInput => {
  const { root, qualifier, value } = filter;
  const { contactAttributeKey } = root;
  const { operator } = qualifier;

  // This base query checks if the contact has an attribute with the specified key
  const baseQuery: Prisma.ContactWhereInput = {
    attributes: {
      some: {
        attributeKey: {
          key: contactAttributeKey,
        },
      },
    },
  };

  // Handle special operators that don't require a value
  if (operator === "isSet") {
    return baseQuery;
  }

  if (operator === "isNotSet") {
    return {
      NOT: baseQuery,
    };
  }

  // For all other operators, we need to check the attribute value
  const valueQuery: Prisma.ContactWhereInput = {
    attributes: {
      some: {
        attributeKey: {
          key: contactAttributeKey,
        },
        value: {},
      },
    },
  };

  // Apply the appropriate operator to the attribute value
  switch (operator) {
    case "equals":
      valueQuery.attributes!.some!.value = String(value);
      break;
    case "notEquals":
      valueQuery.attributes!.some!.value = { not: String(value) };
      break;
    case "contains":
      valueQuery.attributes!.some!.value = { contains: String(value), mode: "insensitive" };
      break;
    case "doesNotContain":
      valueQuery.attributes!.some!.value = { not: { contains: String(value) }, mode: "insensitive" };
      break;
    case "startsWith":
      valueQuery.attributes!.some!.value = { startsWith: String(value), mode: "insensitive" };
      break;
    case "endsWith":
      valueQuery.attributes!.some!.value = { endsWith: String(value), mode: "insensitive" };
      break;
    case "greaterThan":
      // For number comparisons, we convert string value to number first
      // This might need type checking in a real implementation
      valueQuery.attributes!.some!.value = { gt: String(value) };
      break;
    case "greaterEqual":
      valueQuery.attributes!.some!.value = { gte: String(value) };
      break;
    case "lessThan":
      valueQuery.attributes!.some!.value = { lt: String(value) };
      break;
    case "lessEqual":
      valueQuery.attributes!.some!.value = { lte: String(value) };
      break;
    default:
      // Fallback to equals for unknown operators
      valueQuery.attributes!.some!.value = String(value);
  }

  return valueQuery;
};

/**
 * Builds a Prisma where clause from a person filter
 */
const buildPersonFilterWhereClause = (filter: TSegmentPersonFilter): Prisma.ContactWhereInput => {
  const { root, qualifier, value } = filter;
  const { personIdentifier } = root;
  const { operator } = qualifier;

  // Currently user ID is stored as an attribute
  if (personIdentifier === "userId") {
    const personFilter: TSegmentAttributeFilter = {
      ...filter,
      root: {
        type: "attribute",
        contactAttributeKey: "userId",
      },
    };
    return buildAttributeFilterWhereClause(personFilter);
  }

  // Return an empty filter if the person identifier is not supported
  // This could be expanded in the future for more identifiers
  return {};
};

/**
 * Builds a Prisma where clause from a device filter
 */
const buildDeviceFilterWhereClause = (filter: TSegmentDeviceFilter): Prisma.ContactWhereInput => {
  const { root, qualifier, value } = filter;
  const { type } = root;
  const { operator } = qualifier;

  const baseQuery: Prisma.ContactWhereInput = {
    attributes: {
      some: {
        attributeKey: {
          key: type,
        },
        value: {},
      },
    },
  };

  if (operator === "equals") {
    baseQuery.attributes!.some!.value = String(value);
  } else if (operator === "notEquals") {
    baseQuery.attributes!.some!.value = { not: String(value) };
  }

  return baseQuery;
};

/**
 * Recursively processes a segment filter or group and returns a Prisma where clause
 */
const processSingleFilter = (filter: TSegmentFilter): Prisma.ContactWhereInput => {
  const { root } = filter;

  switch (root.type) {
    case "attribute":
      return buildAttributeFilterWhereClause(filter as TSegmentAttributeFilter);
    case "person":
      return buildPersonFilterWhereClause(filter as TSegmentPersonFilter);
    // Implement other filter types as needed (segment, device)
    case "device":
      return buildDeviceFilterWhereClause(filter as TSegmentDeviceFilter);
    default:
      return {};
  }
};

/**
 * Combines multiple where clauses with the specified connector
 */
const combineWhereClauses = (
  whereClauses: Prisma.ContactWhereInput[],
  connector: TSegmentConnector
): Prisma.ContactWhereInput => {
  if (whereClauses.length === 0) return {};
  if (whereClauses.length === 1) return whereClauses[0];

  // For 'AND' connector, combine with AND
  if (connector === "and") {
    return {
      AND: whereClauses,
    };
  }

  // For 'OR' connector or null (default to OR), combine with OR
  return {
    OR: whereClauses,
  };
};

/**
 * Recursively processes filters and returns a combined Prisma where clause
 */
const processFilters = (filters: TBaseFilters): Prisma.ContactWhereInput => {
  if (filters.length === 0) return {};

  const whereClauses: Prisma.ContactWhereInput[] = [];
  let currentConnector: TSegmentConnector = null;

  for (let i = 0; i < filters.length; i++) {
    const { resource, connector } = filters[i];

    // Update the connector for the next filter
    if (i === 0) {
      // For the first filter, store its connector for combining subsequent filters
      currentConnector = connector;
    }

    // Process the resource based on its type
    if (isResourceFilter(resource)) {
      // If it's a single filter, process it directly
      whereClauses.push(processSingleFilter(resource));
    } else {
      // If it's a group of filters, process it recursively
      whereClauses.push(processFilters(resource));
    }
  }

  // Combine all where clauses with the appropriate connector
  return combineWhereClauses(whereClauses, currentConnector);
};

/**
 * Transforms a segment filter into a Prisma query for contacts
 */
export const segmentFilterToPrismaQuery = (
  filters: TBaseFilters,
  environmentId: string
): SegmentFilterQueryResult => {
  // Base where clause to ensure contacts belong to the specified environment
  const baseWhereClause: Prisma.ContactWhereInput = {
    environmentId,
  };

  // Process filters into a Prisma where clause
  const filtersWhereClause = processFilters(filters);

  // Combine the base where clause with the filters where clause
  const whereClause: Prisma.ContactWhereInput = {
    AND: [baseWhereClause, filtersWhereClause],
  };

  return { whereClause };
};
