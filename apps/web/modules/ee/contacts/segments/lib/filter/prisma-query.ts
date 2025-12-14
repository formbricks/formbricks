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
  TTimeUnit,
} from "@formbricks/types/segment";
import { endOfDay, startOfDay, subtractTimeUnit } from "@/modules/ee/contacts/segments/lib/date-utils";
import { isResourceFilter } from "@/modules/ee/contacts/segments/lib/utils";
import { getSegment } from "../segments";

const isDateOperator = (operator: string): operator is TDateOperator => {
  return DATE_OPERATORS.includes(operator as TDateOperator);
};

const buildDateAttributeFilterWhereClause = (filter: TSegmentAttributeFilter): Prisma.StringFilter => {
  const { qualifier, value } = filter;
  const { operator } = qualifier;

  if (operator === "isOlderThan" || operator === "isNewerThan") {
    if (typeof value !== "object" || Array.isArray(value) || !("amount" in value) || !("unit" in value)) {
      return {};
    }

    const { amount, unit } = value as { amount: number; unit: TTimeUnit };
    const now = new Date();
    const thresholdDate = subtractTimeUnit(now, amount, unit);

    if (operator === "isOlderThan") {
      return { lt: thresholdDate.toISOString() };
    } else {
      return { gt: thresholdDate.toISOString() };
    }
  }

  if (operator === "isBetween") {
    if (!Array.isArray(value) || value.length !== 2) {
      return {};
    }
    const [startStr, endStr] = value as [string, string];
    const startDate = startOfDay(new Date(startStr));
    const endDate = endOfDay(new Date(endStr));

    return {
      gte: startDate.toISOString(),
      lte: endDate.toISOString(),
    };
  }

  if (typeof value !== "string") {
    return {};
  }
  const compareDate = new Date(value);

  switch (operator) {
    case "isBefore":
      return { lt: startOfDay(compareDate).toISOString() };
    case "isAfter":
      return { gt: endOfDay(compareDate).toISOString() };
    case "isSameDay":
      return {
        gte: startOfDay(compareDate).toISOString(),
        lte: endOfDay(compareDate).toISOString(),
      };
    default:
      return {};
  }
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

  if (isDateOperator(operator)) {
    // @ts-ignore
    valueQuery.attributes.some.value = buildDateAttributeFilterWhereClause(filter);
    return valueQuery;
  }

  // Apply the appropriate operator to the attribute value
  switch (operator) {
    case "equals":
      // @ts-ignore
      valueQuery.attributes.some.value = { equals: String(value), mode: "insensitive" };
      break;
    case "notEquals":
      // @ts-ignore
      valueQuery.attributes.some.value = { not: String(value), mode: "insensitive" };
      break;
    case "contains":
      // @ts-ignore
      valueQuery.attributes.some.value = { contains: String(value), mode: "insensitive" };
      break;
    case "doesNotContain":
      // @ts-ignore
      valueQuery.attributes.some.value = { not: { contains: String(value) }, mode: "insensitive" };
      break;
    case "startsWith":
      // @ts-ignore
      valueQuery.attributes.some.value = { startsWith: String(value), mode: "insensitive" };
      break;
    case "endsWith":
      // @ts-ignore
      valueQuery.attributes.some.value = { endsWith: String(value), mode: "insensitive" };
      break;
    case "greaterThan":
      // @ts-ignore
      valueQuery.attributes.some.value = { gt: String(value) };
      break;
    case "greaterEqual":
      // @ts-ignore
      valueQuery.attributes.some.value = { gte: String(value) };
      break;
    case "lessThan":
      // @ts-ignore
      valueQuery.attributes.some.value = { lt: String(value) };
      break;
    case "lessEqual":
      // @ts-ignore
      valueQuery.attributes.some.value = { lte: String(value) };
      break;
    default:
      // @ts-ignore
      valueQuery.attributes.some.value = String(value);
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

  const baseQuery = {
    attributes: {
      some: {
        attributeKey: {
          key: type,
        },
        value: {},
      },
    },
  } satisfies Prisma.ContactWhereInput;

  if (operator === "equals") {
    baseQuery.attributes.some.value = { equals: String(value), mode: "insensitive" };
  } else if (operator === "notEquals") {
    baseQuery.attributes.some.value = { not: String(value), mode: "insensitive" };
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
    ...(query.AND.length > 0 ? { AND: query.AND } : {}),
    ...(query.OR.length > 0 ? { OR: query.OR } : {}),
  };
};

/**
 * Transforms a segment filter into a Prisma query for contacts
 */
export const segmentFilterToPrismaQuery = reactCache(
  async (segmentId: string, filters: TBaseFilters, environmentId: string) => {
    try {
      const baseWhereClause = {
        environmentId,
      };

      // Initialize an empty stack for tracking the current evaluation path
      const segmentPath = new Set<string>([segmentId]);
      const filtersWhereClause = await processFilters(filters, segmentPath);

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
