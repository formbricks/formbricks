import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TBaseFilter } from "@formbricks/types/segment";
import { cache } from "@/lib/cache";
import { validateInputs } from "@/lib/utils/validate";
import { evaluateSegment } from "@/modules/ee/contacts/segments/lib/segments";

export const getSegments = reactCache(
  async (environmentId: string) =>
    await cache.withCache(
      async () => {
        try {
          const segments = await prisma.segment.findMany({
            where: { environmentId },
            // Include all necessary fields for evaluateSegment to work
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
  attributes: Record<string, string>,
  deviceType: "phone" | "desktop"
): Promise<string[]> => {
  try {
    validateInputs([environmentId, ZId], [contactId, ZId], [contactUserId, ZString]);

    const segments = await getSegments(environmentId);

    // fast path; if there are no segments, return an empty array
    if (!segments || !Array.isArray(segments)) {
      return [];
    }

    const personSegments: { id: string; filters: TBaseFilter[] }[] = [];

    for (const segment of segments) {
      const isIncluded = await evaluateSegment(
        {
          attributes,
          deviceType,
          environmentId,
          contactId: contactId,
          userId: contactUserId,
        },
        segment.filters
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
