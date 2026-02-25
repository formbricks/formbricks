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

    // Phase 1: Build WHERE clauses sequentially to avoid connection pool contention.
    // segmentFilterToPrismaQuery can itself hit the DB (e.g. unmigrated-row checks),
    // so running all builds concurrently would saturate the pool.
    const alwaysMatchIds: string[] = [];
    const dbChecks: { segmentId: string; whereClause: Prisma.ContactWhereInput }[] = [];

    for (const segment of segments) {
      const filters = segment.filters as TBaseFilters;

      if (!filters?.length) {
        alwaysMatchIds.push(segment.id);
        continue;
      }

      const queryResult = await segmentFilterToPrismaQuery(segment.id, filters, environmentId, deviceType);

      if (!queryResult.ok) {
        logger.warn(
          { segmentId: segment.id, environmentId, error: queryResult.error },
          "Failed to build Prisma query for segment, skipping"
        );
        continue;
      }

      dbChecks.push({ segmentId: segment.id, whereClause: queryResult.data.whereClause });
    }

    if (dbChecks.length === 0) {
      return alwaysMatchIds;
    }

    // Phase 2: Execute all membership checks in a single transaction.
    // Uses one connection instead of N concurrent ones, eliminating pool contention.
    const txResults = await prisma.$transaction(
      dbChecks.map(({ whereClause }) =>
        prisma.contact.findFirst({
          where: { id: contactId, ...whereClause },
          select: { id: true },
        })
      )
    );

    const matchedIds = dbChecks.filter((_, i) => txResults[i] !== null).map(({ segmentId }) => segmentId);

    return [...alwaysMatchIds, ...matchedIds];
  } catch (error) {
    logger.warn(
      { environmentId, contactId, error },
      "Failed to get person segment IDs, returning empty array"
    );
    return [];
  }
};
