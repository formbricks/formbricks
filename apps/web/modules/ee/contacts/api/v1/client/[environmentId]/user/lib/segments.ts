import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TBaseFilter, TBaseFilters } from "@formbricks/types/segment";
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
 */
const isContactInSegment = async (
  contactId: string,
  segmentId: string,
  filters: TBaseFilters,
  environmentId: string
): Promise<boolean> => {
  // If no filters, segment matches all contacts
  if (!filters || filters.length === 0) {
    return true;
  }

  const queryResult = await segmentFilterToPrismaQuery(segmentId, filters, environmentId);

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
  // These params are kept for backwards compatibility but unused with Prisma-based evaluation
  // The Prisma query fetches attributes directly from the database
  _attributes: Record<string, string>,
  _deviceType: "phone" | "desktop"
): Promise<string[]> => {
  try {
    validateInputs([environmentId, ZId], [contactId, ZId], [contactUserId, ZString]);

    const segments = await getSegments(environmentId);

    // fast path; if there are no segments, return an empty array
    if (!segments || !Array.isArray(segments)) {
      return [];
    }

    const personSegments: { id: string; filters: TBaseFilter[] }[] = [];

    // Use Prisma-based segment evaluation for accurate typed attribute comparisons
    for (const segment of segments) {
      const isIncluded = await isContactInSegment(
        contactId,
        segment.id,
        segment.filters as TBaseFilters,
        environmentId
      );

      if (isIncluded) {
        personSegments.push(segment);
      }
    }

    return personSegments.map((segment) => segment.id);
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
