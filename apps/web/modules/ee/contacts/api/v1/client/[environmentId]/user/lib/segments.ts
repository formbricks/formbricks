import { validateInputs } from "@/lib/utils/validate";
import { createCacheKey } from "@/modules/cache/lib/cacheKeys";
import { withCache } from "@/modules/cache/lib/withCache";
import { evaluateSegment } from "@/modules/ee/contacts/segments/lib/segments";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TBaseFilter } from "@formbricks/types/segment";

export const getSegments = reactCache((environmentId: string) =>
  withCache(
    async () => {
      try {
        const segments = await prisma.segment.findMany({
          where: { environmentId },
          select: { id: true, filters: true },
        });

        return segments;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    {
      key: createCacheKey.environment.config(environmentId),
      // 30 minutes TTL - segment definitions change infrequently
      ttl: 60 * 30,
    }
  )()
);

export const getPersonSegmentIds = async (
  environmentId: string,
  contactId: string,
  contactUserId: string,
  attributes: Record<string, string>,
  deviceType: "phone" | "desktop"
): Promise<string[]> => {
  validateInputs([environmentId, ZId], [contactId, ZId], [contactUserId, ZString]);

  const segments = await getSegments(environmentId);

  // fast path; if there are no segments, return an empty array
  if (!segments) {
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
};
