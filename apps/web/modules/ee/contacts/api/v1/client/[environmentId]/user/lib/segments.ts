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

export const getPersonSegmentIds = async (
  environmentId: string,
  contactId: string,
  contactUserId: string,
  deviceType: "phone" | "desktop"
): Promise<string[]> => {
  try {
    validateInputs([environmentId, ZId], [contactId, ZId], [contactUserId, ZString]);

    const segments = await getSegments(environmentId);

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return [];
    }

    // Phase 1: Build all Prisma where clauses concurrently.
    // This converts segment filters into where clauses without per-contact DB queries.
    const segmentWithClauses = await Promise.all(
      segments.map(async (segment) => {
        const filters = segment.filters as TBaseFilters | null;

        if (!filters || filters.length === 0) {
          return { segmentId: segment.id, whereClause: {} as Prisma.ContactWhereInput };
        }

        const queryResult = await segmentFilterToPrismaQuery(segment.id, filters, environmentId, deviceType);

        if (!queryResult.ok) {
          logger.warn(
            { segmentId: segment.id, environmentId, error: queryResult.error },
            "Failed to build Prisma query for segment"
          );
          return { segmentId: segment.id, whereClause: null };
        }

        return { segmentId: segment.id, whereClause: queryResult.data.whereClause };
      })
    );

    // Separate segments into: always-match (no filters), needs-DB-check, and failed-to-build
    const alwaysMatchIds: string[] = [];
    const toCheck: { segmentId: string; whereClause: Prisma.ContactWhereInput }[] = [];

    for (const item of segmentWithClauses) {
      if (item.whereClause === null) {
        continue;
      }

      if (Object.keys(item.whereClause).length === 0) {
        alwaysMatchIds.push(item.segmentId);
      } else {
        toCheck.push({ segmentId: item.segmentId, whereClause: item.whereClause });
      }
    }

    if (toCheck.length === 0) {
      return alwaysMatchIds;
    }

    // Phase 2: Batch all contact-match checks into a single DB transaction.
    // Replaces N individual findFirst queries with one batched round-trip.
    const batchResults = await prisma.$transaction(
      toCheck.map(({ whereClause }) =>
        prisma.contact.findFirst({
          where: { id: contactId, ...whereClause },
          select: { id: true },
        })
      )
    );

    // Phase 3: Collect matching segment IDs
    const dbMatchIds = toCheck.filter((_, i) => batchResults[i] !== null).map(({ segmentId }) => segmentId);

    return [...alwaysMatchIds, ...dbMatchIds];
  } catch (error) {
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
