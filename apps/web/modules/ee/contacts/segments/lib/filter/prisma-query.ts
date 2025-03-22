import { isResourceFilter } from "@/modules/ee/contacts/segments/lib/utils";
import { Prisma } from "@prisma/client";
import {
  TBaseFilters,
  TSegmentAttributeFilter,
  TSegmentDeviceFilter,
  TSegmentFilter,
  TSegmentPersonFilter,
  TSegmentSegmentFilter,
} from "@formbricks/types/segment";
import { getSegment } from "../segments";

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

const buildSegmentFilterWhereClause = async (
  filter: TSegmentSegmentFilter
): Promise<Prisma.ContactWhereInput> => {
  const { root } = filter;
  const { segmentId } = root;

  const segment = await getSegment(segmentId);

  // ! TODO: Handle errors

  return processFilters(segment.filters);
};

/**
 * Recursively processes a segment filter or group and returns a Prisma where clause
 */
const processSingleFilter = async (filter: TSegmentFilter): Promise<Prisma.ContactWhereInput> => {
  const { root } = filter;

  switch (root.type) {
    case "attribute":
      return buildAttributeFilterWhereClause(filter as TSegmentAttributeFilter);
    case "person":
      return buildPersonFilterWhereClause(filter as TSegmentPersonFilter);
    // Implement other filter types as needed (segment, device)
    case "device":
      return buildDeviceFilterWhereClause(filter as TSegmentDeviceFilter);
    case "segment":
      return await buildSegmentFilterWhereClause(filter as TSegmentSegmentFilter);
    default:
      return {};
  }
};

/**
 * Recursively processes filters and returns a combined Prisma where clause
 */
const processFilters = async (filters: TBaseFilters): Promise<Prisma.ContactWhereInput> => {
  if (filters.length === 0) return {};

  const query: { AND: Prisma.ContactWhereInput[]; OR: Prisma.ContactWhereInput[] } = {
    AND: [],
    OR: [],
  };

  for (let i = 0; i < filters.length; i++) {
    const { resource, connector } = filters[i];
    let whereClause: Prisma.ContactWhereInput;

    // Process the resource based on its type
    if (isResourceFilter(resource)) {
      // If it's a single filter, process it directly
      whereClause = await processSingleFilter(resource);
    } else {
      // If it's a group of filters, process it recursively
      whereClause = await processFilters(resource);
    }

    if (filters.length === 1) query.AND = [whereClause];
    else {
      if (i === 0) {
        if (filters[1].connector === "and") query.AND.push(whereClause);
        else query.OR.push(whereClause);
      } else {
        let currConnector = connector;
        if (currConnector === "and") query.AND.push(whereClause);
        else query.OR.push(whereClause);
      }
    }
  }

  return query;
};

/**
 * Transforms a segment filter into a Prisma query for contacts
 */
export const segmentFilterToPrismaQuery = async (
  filters: TBaseFilters,
  environmentId: string
): Promise<SegmentFilterQueryResult> => {
  // Base where clause to ensure contacts belong to the specified environment
  const baseWhereClause: Prisma.ContactWhereInput = {
    environmentId,
  };

  // Process filters into a Prisma where clause
  const filtersWhereClause = await processFilters(filters);

  // Combine the base where clause with the filters where clause
  const whereClause: Prisma.ContactWhereInput = {
    AND: [baseWhereClause, filtersWhereClause],
  };

  return { whereClause };
};
