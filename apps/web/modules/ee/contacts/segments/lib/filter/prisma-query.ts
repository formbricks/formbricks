import { isResourceFilter } from "@/modules/ee/contacts/segments/lib/utils";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { cache } from "@formbricks/lib/cache";
import { segmentCache } from "@formbricks/lib/cache/segment";
import { logger } from "@formbricks/logger";
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
      valueQuery.attributes!.some!.value = String(value);
  }

  return valueQuery;
};

/**
 * Builds a Prisma where clause from a person filter
 */
const buildPersonFilterWhereClause = (filter: TSegmentPersonFilter): Prisma.ContactWhereInput => {
  const { personIdentifier } = filter.root;

  if (personIdentifier === "userId") {
    const personFilter: TSegmentAttributeFilter = {
      ...filter,
      root: {
        type: "attribute",
        contactAttributeKey: personIdentifier,
      },
    };
    return buildAttributeFilterWhereClause(personFilter);
  }

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
 * Builds a Prisma where clause from a segment filter
 */
const buildSegmentFilterWhereClause = async (
  filter: TSegmentSegmentFilter,
  segmentPath: Set<string>
): Promise<Prisma.ContactWhereInput> => {
  const { root } = filter;
  const { segmentId } = root;

  if (segmentPath.has(segmentId)) {
    logger.error(
      { segmentId, path: Array.from(segmentPath) },
      "Circular reference detected in segment filter"
    );
    return {};
  }

  const segment = await getSegment(segmentId);

  if (!segment) {
    logger.error({ segmentId }, "Segment not found");
    return {};
  }

  const newPath = new Set(segmentPath);
  newPath.add(segmentId);

  return processFilters(segment.filters, newPath);
};

/**
 * Recursively processes a segment filter or group and returns a Prisma where clause
 */
const processSingleFilter = async (
  filter: TSegmentFilter,
  segmentPath: Set<string>
): Promise<Prisma.ContactWhereInput> => {
  const { root } = filter;

  switch (root.type) {
    case "attribute":
      return buildAttributeFilterWhereClause(filter as TSegmentAttributeFilter);
    case "person":
      return buildPersonFilterWhereClause(filter as TSegmentPersonFilter);
    case "device":
      return buildDeviceFilterWhereClause(filter as TSegmentDeviceFilter);
    case "segment":
      return await buildSegmentFilterWhereClause(filter as TSegmentSegmentFilter, segmentPath);
    default:
      return {};
  }
};

/**
 * Recursively processes filters and returns a combined Prisma where clause
 */
const processFilters = async (
  filters: TBaseFilters,
  segmentPath: Set<string>
): Promise<Prisma.ContactWhereInput> => {
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
      whereClause = await processSingleFilter(resource, segmentPath);
    } else {
      // If it's a group of filters, process it recursively
      whereClause = await processFilters(resource, segmentPath);
    }

    if (Object.keys(whereClause).length === 0) continue;
    if (filters.length === 1) query.AND = [whereClause];
    else {
      if (i === 0) {
        if (filters[1].connector === "and") query.AND.push(whereClause);
        else query.OR.push(whereClause);
      } else {
        if (connector === "and") query.AND.push(whereClause);
        else query.OR.push(whereClause);
      }
    }
  }

  return {
    AND: query.AND.length > 0 ? query.AND : undefined,
    OR: query.OR.length > 0 ? query.OR : undefined,
  };
};

/**
 * Transforms a segment filter into a Prisma query for contacts
 */
export const segmentFilterToPrismaQuery = reactCache(
  async (
    segmentId: string,
    filters: TBaseFilters,
    environmentId: string
  ): Promise<SegmentFilterQueryResult> =>
    cache(
      async () => {
        try {
          const baseWhereClause: Prisma.ContactWhereInput = {
            environmentId,
          };

          // Initialize an empty stack for tracking the current evaluation path
          const segmentPath = new Set<string>([segmentId]);
          const filtersWhereClause = await processFilters(filters, segmentPath);

          const whereClause: Prisma.ContactWhereInput = {
            AND: [baseWhereClause, filtersWhereClause],
          };

          return { whereClause };
        } catch (error) {
          logger.error(
            {
              error,
              segmentId,
              environmentId,
            },
            "Error transforming segment filter to Prisma query"
          );
          throw error;
        }
      },
      [`segmentFilterToPrismaQuery-${segmentId}-${environmentId}-${JSON.stringify(filters)}`],
      {
        tags: [segmentCache.tag.byEnvironmentId(environmentId), segmentCache.tag.byId(segmentId)],
      }
    )()
);
