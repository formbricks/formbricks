import { attributeCache } from "@formbricks/lib/attribute/cache";
import { getAttributes } from "@formbricks/lib/attribute/service";
import { cache } from "@formbricks/lib/cache";
import { segmentCache } from "@formbricks/lib/segment/cache";
import { evaluateSegment, getSegments } from "@formbricks/lib/segment/service";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { TPerson, ZPerson } from "@formbricks/types/people";
import { TSegment } from "@formbricks/types/segment";

export const getPersonSegmentIds = (
  environmentId: string,
  person: TPerson,
  deviceType: "phone" | "desktop"
): Promise<string[]> =>
  cache(
    async () => {
      validateInputs([environmentId, ZId], [person, ZPerson]);

      const segments = await getSegments(environmentId);

      // fast path; if there are no segments, return an empty array
      if (!segments) {
        return [];
      }

      const attributes = await getAttributes(person.id);

      const personSegments: TSegment[] = [];

      for (const segment of segments) {
        const isIncluded = await evaluateSegment(
          {
            attributes,
            actionIds: [],
            deviceType,
            environmentId,
            personId: person.id,
            userId: person.userId,
          },
          segment.filters
        );

        if (isIncluded) {
          personSegments.push(segment);
        }
      }

      return personSegments.map((segment) => segment.id);
    },
    [`getPersonSegmentIds-${environmentId}-${person.id}-${deviceType}`],
    {
      tags: [segmentCache.tag.byEnvironmentId(environmentId), attributeCache.tag.byPersonId(person.id)],
    }
  )();
