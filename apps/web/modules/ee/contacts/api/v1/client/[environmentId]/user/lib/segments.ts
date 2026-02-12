import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TBaseFilters } from "@formbricks/types/segment";
import { cache } from "@/lib/cache";
import { validateInputs } from "@/lib/utils/validate";
import { segmentFilterToPrismaQuery } from "@/modules/ee/contacts/segments/lib/filter/prisma-query";

export const getSegments = reactCache(
  async (environmentId: string) =>
    await cache.withCache(
      async () => {
        try {
          const segments = await prisma.segment.findMany({
            where: { environmentId },
            select: {
              id: true,
              filters: true,
            },
          });

          return segments || [];
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      createCacheKey.environment.segments(environmentId),
      60 * 1000 // 1 minutes in milliseconds
    )
);

/**
 * Checks if a contact matches a segment using Prisma query
 * This leverages native DB types (valueDate, valueNumber) for accurate comparisons
 * Device filters are evaluated at query build time using the provided deviceType
 */
const isContactInSegment = async (
  contactId: string,
  segmentId: string,
  filters: TBaseFilters,
  environmentId: string,
  deviceType: "phone" | "desktop"
): Promise<boolean> => {
  // If no filters, segment matches all contacts
  if (!filters || filters.length === 0) {
    return true;
  }

  const queryResult = await segmentFilterToPrismaQuery(segmentId, filters, environmentId, deviceType);

  if (!queryResult.ok) {
    logger.warn(
      { segmentId, environmentId, error: queryResult.error },
      "Failed to build Prisma query for segment"
    );
    return false;
  }

  const { whereClause } = queryResult.data;

  // Check if this specific contact matches the segment filters
  const matchingContact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      ...whereClause,
    },
    select: { id: true },
  });

  return matchingContact !== null;
};

export const getPersonSegmentIds = async (
  environmentId: string,
  contactId: string,
  contactUserId: string,
  // Attributes param kept for backwards compatibility but unused - Prisma fetches from DB
  _attributes: Record<string, string>,
  deviceType: "phone" | "desktop"
): Promise<string[]> => {
  try {
    validateInputs([environmentId, ZId], [contactId, ZId], [contactUserId, ZString]);

    const segments = await getSegments(environmentId);

    // fast path; if there are no segments, return an empty array
    if (!segments || !Array.isArray(segments)) {
      return [];
    }

    // Device filters are evaluated at query build time using the provided deviceType
    const segmentPromises = segments.map(async (segment) => {
      const filters = segment.filters;
      const isIncluded = await isContactInSegment(contactId, segment.id, filters, environmentId, deviceType);
      return isIncluded ? segment.id : null;
    });

    const results = await Promise.all(segmentPromises);

    return results.filter((id): id is string => id !== null);
  } catch (error) {
    // Log error for debugging but don't throw to prevent "segments is not iterable" error
    logger.warn(
      {
        environmentId,
        contactId,
        error,
      },
      "Failed to get person segment IDs, returning empty array"
    );
    return [];
  }
};
