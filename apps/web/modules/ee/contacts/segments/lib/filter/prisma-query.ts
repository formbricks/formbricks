import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { logger } from "@formbricks/logger";
import { err, ok } from "@formbricks/types/error-handlers";
import {
  DATE_OPERATORS,
  TBaseFilters,
  TDateOperator,
  TSegmentAttributeFilter,
  TSegmentDeviceFilter,
  TSegmentFilter,
  TSegmentPersonFilter,
  TSegmentSegmentFilter,
} from "@formbricks/types/segment";
import { isResourceFilter } from "@/modules/ee/contacts/segments/lib/utils";
import { endOfDay, startOfDay, subtractTimeUnit } from "../date-utils";
import { getSegment } from "../segments";

// Type for the result of the segment filter to prisma query generation
export type SegmentFilterQueryResult = {
  whereClause: Prisma.ContactWhereInput;
};

/**
 * Builds a Prisma where clause for date attribute filters
 * Uses the native valueDate column for performant DateTime comparisons
 */
const buildDateAttributeFilterWhereClause = (filter: TSegmentAttributeFilter): Prisma.ContactWhereInput => {
  const { root, qualifier, value } = filter;
  const { contactAttributeKey } = root;
  const { operator } = qualifier as { operator: TDateOperator };
  const now = new Date();

  let dateCondition: Prisma.DateTimeNullableFilter = {};

  switch (operator) {
    case "isOlderThan": {
      // value should be { amount, unit }
      if (typeof value === "object" && "amount" in value && "unit" in value) {
        const threshold = subtractTimeUnit(now, value.amount, value.unit);
        dateCondition = { lt: threshold };
      }
      break;
    }
    case "isNewerThan": {
      // value should be { amount, unit }
      if (typeof value === "object" && "amount" in value && "unit" in value) {
        const threshold = subtractTimeUnit(now, value.amount, value.unit);
        dateCondition = { gte: threshold };
      }
      break;
    }
    case "isBefore":
      if (typeof value === "string") {
        dateCondition = { lt: new Date(value) };
      }
      break;
    case "isAfter":
      if (typeof value === "string") {
        dateCondition = { gt: new Date(value) };
      }
      break;
    case "isBetween":
      if (Array.isArray(value) && value.length === 2) {
        dateCondition = { gte: new Date(value[0]), lte: new Date(value[1]) };
      }
      break;
    case "isSameDay": {
      if (typeof value === "string") {
        const dayStart = startOfDay(new Date(value));
        const dayEnd = endOfDay(new Date(value));
        dateCondition = { gte: dayStart, lte: dayEnd };
      }
      break;
    }
  }

  return {
    attributes: {
      some: {
        attributeKey: { key: contactAttributeKey },
        valueDate: dateCondition,
      },
    },
  };
};

/**
 * Builds a Prisma where clause for number attribute filters
 * Uses the native valueNumber column for performant numeric comparisons
 */
const buildNumberAttributeFilterWhereClause = (filter: TSegmentAttributeFilter): Prisma.ContactWhereInput => {
  const { root, qualifier, value } = filter;
  const { contactAttributeKey } = root;
  const { operator } = qualifier;

  const numericValue = typeof value === "number" ? value : Number(value);

  let numberCondition: Prisma.FloatNullableFilter = {};

  switch (operator) {
    case "greaterThan":
      numberCondition = { gt: numericValue };
      break;
    case "greaterEqual":
      numberCondition = { gte: numericValue };
      break;
    case "lessThan":
      numberCondition = { lt: numericValue };
      break;
    case "lessEqual":
      numberCondition = { lte: numericValue };
      break;
  }

  return {
    attributes: {
      some: {
        attributeKey: { key: contactAttributeKey },
        valueNumber: numberCondition,
      },
    },
  };
};

/**
 * Builds a Prisma where clause from a segment attribute filter
 */
const buildAttributeFilterWhereClause = (filter: TSegmentAttributeFilter): Prisma.ContactWhereInput => {
  const { root, qualifier, value } = filter;
  const { contactAttributeKey } = root;
  const { operator } = qualifier;

  // This base query checks if the contact has an attribute with the specified key
  const baseQuery = {
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
  const valueQuery = {
    attributes: {
      some: {
        attributeKey: {
          key: contactAttributeKey,
        },
        value: {},
      },
    },
  } satisfies Prisma.ContactWhereInput;

  // Handle date operators
  if (DATE_OPERATORS.includes(operator as TDateOperator)) {
    return buildDateAttributeFilterWhereClause(filter);
  }

  // Handle number operators
  if (["greaterThan", "greaterEqual", "lessThan", "lessEqual"].includes(operator)) {
    return buildNumberAttributeFilterWhereClause(filter);
  }

  // For string operators, ensure value is a primitive (not an object or array)
  // This handles cases where value might be { amount, unit } or [start, end] from date/range filters
  const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);

  // Apply the appropriate operator to the attribute value
  switch (operator) {
    case "equals":
      valueQuery.attributes.some.value = { equals: stringValue, mode: "insensitive" };
      break;
    case "notEquals":
      valueQuery.attributes.some.value = { not: stringValue, mode: "insensitive" };
      break;
    case "contains":
      valueQuery.attributes.some.value = { contains: stringValue, mode: "insensitive" };
      break;
    case "doesNotContain":
      valueQuery.attributes.some.value = { not: { contains: stringValue }, mode: "insensitive" };
      break;
    case "startsWith":
      valueQuery.attributes.some.value = { startsWith: stringValue, mode: "insensitive" };
      break;
    case "endsWith":
      valueQuery.attributes.some.value = { endsWith: stringValue, mode: "insensitive" };
      break;
    default:
      valueQuery.attributes.some.value = stringValue;
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
 * Since device type is a runtime property (from User-Agent), we evaluate it immediately
 * and return either no constraint (match) or an impossible condition (no match)
 */
const buildDeviceFilterWhereClause = (
  filter: TSegmentDeviceFilter,
  deviceType?: "phone" | "desktop"
): Prisma.ContactWhereInput => {
  // If no device type provided, skip device filter (return no constraint)
  if (!deviceType) {
    return {};
  }

  const { qualifier, value } = filter;
  const { operator } = qualifier;

  // Evaluate device filter immediately since it's a runtime property
  let matches: boolean;
  if (operator === "equals") {
    matches = deviceType === value;
  } else if (operator === "notEquals") {
    matches = deviceType !== value;
  } else {
    matches = false;
  }

  if (matches) {
    // Device matches - return empty constraint (effectively "true")
    return {};
  } else {
    // Device doesn't match - return impossible condition (effectively "false")
    // This ensures the query won't match any contacts
    return { id: "__DEVICE_FILTER_NO_MATCH__" };
  }
};

/**
 * Builds a Prisma where clause from a segment filter
 */
const buildSegmentFilterWhereClause = async (
  filter: TSegmentSegmentFilter,
  segmentPath: Set<string>,
  deviceType?: "phone" | "desktop"
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

  return processFilters(segment.filters, newPath, deviceType);
};

/**
 * Recursively processes a segment filter or group and returns a Prisma where clause
 */
const processSingleFilter = async (
  filter: TSegmentFilter,
  segmentPath: Set<string>,
  deviceType?: "phone" | "desktop"
): Promise<Prisma.ContactWhereInput> => {
  const { root } = filter;

  switch (root.type) {
    case "attribute":
      return buildAttributeFilterWhereClause(filter as TSegmentAttributeFilter);
    case "person":
      return buildPersonFilterWhereClause(filter as TSegmentPersonFilter);
    case "device":
      return buildDeviceFilterWhereClause(filter as TSegmentDeviceFilter, deviceType);
    case "segment":
      return await buildSegmentFilterWhereClause(filter as TSegmentSegmentFilter, segmentPath, deviceType);
    default:
      return {};
  }
};

/**
 * Recursively processes filters and returns a combined Prisma where clause
 */
const processFilters = async (
  filters: TBaseFilters,
  segmentPath: Set<string>,
  deviceType?: "phone" | "desktop"
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
      whereClause = await processSingleFilter(resource, segmentPath, deviceType);
    } else {
      // If it's a group of filters, process it recursively
      whereClause = await processFilters(resource, segmentPath, deviceType);
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
    ...(query.AND.length > 0 ? { AND: query.AND } : {}),
    ...(query.OR.length > 0 ? { OR: query.OR } : {}),
  };
};

/**
 * Transforms a segment filter into a Prisma query for contacts
 * @param segmentId - The segment ID being evaluated
 * @param filters - The segment filters
 * @param environmentId - The environment ID
 * @param deviceType - Optional device type for runtime device filter evaluation
 */
export const segmentFilterToPrismaQuery = reactCache(
  async (
    segmentId: string,
    filters: TBaseFilters,
    environmentId: string,
    deviceType?: "phone" | "desktop"
  ) => {
    try {
      const baseWhereClause = {
        environmentId,
      };

      // Initialize an empty stack for tracking the current evaluation path
      const segmentPath = new Set<string>([segmentId]);
      const filtersWhereClause = await processFilters(filters, segmentPath, deviceType);

      const whereClause = {
        AND: [baseWhereClause, filtersWhereClause],
      };

      return ok({ whereClause });
    } catch (error) {
      logger.error({ error, segmentId, environmentId }, "Error transforming segment filter to Prisma query");
      return err({
        type: "bad_request",
        message: "Failed to convert segment filters to Prisma query",
        details: [{ field: "segment", issue: "Invalid segment filters" }],
      });
    }
  }
);
