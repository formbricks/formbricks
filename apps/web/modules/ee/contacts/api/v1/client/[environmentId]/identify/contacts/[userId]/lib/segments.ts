import { cache } from "@/lib/cache";
import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { segmentCache } from "@/lib/cache/segment";
import { validateInputs } from "@/lib/utils/validate";
import { getContactAttributes } from "@/modules/ee/contacts/api/v1/client/[environmentId]/identify/contacts/[userId]/lib/attributes";
import { evaluateSegment } from "@/modules/ee/contacts/segments/lib/segments";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { ZId, ZString } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { TBaseFilter } from "@formbricks/types/segment";

export const getSegments = reactCache((environmentId: string) =>
  cache(
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
    [`getSegments-environmentId-${environmentId}`],
    {
      tags: [segmentCache.tag.byEnvironmentId(environmentId)],
    }
  )()
);

export const getPersonSegmentIds = (
  environmentId: string,
  contactId: string,
  contactUserId: string,
  deviceType: "phone" | "desktop"
): Promise<string[]> =>
  cache(
    async () => {
      validateInputs([environmentId, ZId], [contactId, ZId], [contactUserId, ZString]);

      const segments = await getSegments(environmentId);

      // fast path; if there are no segments, return an empty array
      if (!segments) {
        return [];
      }

      const contactAttributes = await getContactAttributes(contactId);

      const personSegments: { id: string; filters: TBaseFilter[] }[] = [];

      for (const segment of segments) {
        const isIncluded = await evaluateSegment(
          {
            attributes: contactAttributes,
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
    },
    [`getPersonSegmentIds-${environmentId}-${contactId}-${deviceType}`],
    {
      tags: [
        segmentCache.tag.byEnvironmentId(environmentId),
        contactAttributeCache.tag.byContactId(contactId),
      ],
    }
  )();
