import { getPersonSegmentIds } from "@/app/api/v1/client/[environmentId]/app/people/[userId]/lib/segments";
import { prisma } from "@formbricks/database";
import { attributeCache } from "@formbricks/lib/attribute/cache";
import { getAttributesByUserId } from "@formbricks/lib/attribute/service";
import { cache } from "@formbricks/lib/cache";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { displayCache } from "@formbricks/lib/display/cache";
import { getDisplaysByUserId } from "@formbricks/lib/display/service";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { personCache } from "@formbricks/lib/person/cache";
import { getPersonByUserId } from "@formbricks/lib/person/service";
import { responseCache } from "@formbricks/lib/response/cache";
import { getResponsesByUserId } from "@formbricks/lib/response/service";
import { segmentCache } from "@formbricks/lib/segment/cache";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TJsPersonState } from "@formbricks/types/js";

/**
 *
 * @param environmentId - The environment id
 * @param userId - The user id
 * @param device - The device type
 * @returns The person state
 * @throws {ValidationError} - If the input is invalid
 * @throws {ResourceNotFoundError} - If the environment or organization is not found
 * @throws {OperationNotAllowedError} - If the MAU limit is reached and the person has not been active this month
 */
export const getPersonState = async ({
  environmentId,
  userId,
  device,
}: {
  environmentId: string;
  userId: string;
  device: "phone" | "desktop";
}): Promise<{ state: TJsPersonState["data"]; revalidateProps?: { personId: string; revalidate: boolean } }> =>
  cache(
    async () => {
      let revalidatePerson = false;
      const environment = await getEnvironment(environmentId);

      if (!environment) {
        throw new ResourceNotFoundError(`environment`, environmentId);
      }

      const organization = await getOrganizationByEnvironmentId(environmentId);

      if (!organization) {
        throw new ResourceNotFoundError(`organization`, environmentId);
      }

      let person = await getPersonByUserId(environmentId, userId);

      if (!person) {
        person = await prisma.person.create({
          data: {
            environment: {
              connect: {
                id: environmentId,
              },
            },
            userId,
          },
        });

        revalidatePerson = true;
      }

      const personResponses = await getResponsesByUserId(environmentId, userId);
      const personDisplays = await getDisplaysByUserId(environmentId, userId);
      const segments = await getPersonSegmentIds(environmentId, person, device);
      const attributes = await getAttributesByUserId(environmentId, userId);

      // If the person exists, return the persons's state
      const userState: TJsPersonState["data"] = {
        userId: person.userId,
        segments,
        displays:
          personDisplays?.map((display) => ({ surveyId: display.surveyId, createdAt: display.createdAt })) ??
          [],
        responses: personResponses?.map((response) => response.surveyId) ?? [],
        attributes,
        lastDisplayAt:
          personDisplays.length > 0
            ? personDisplays.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
            : null,
      };

      return {
        state: userState,
        revalidateProps: revalidatePerson ? { personId: person.id, revalidate: true } : undefined,
      };
    },
    [`personState-${environmentId}-${userId}-${device}`],
    {
      ...(IS_FORMBRICKS_CLOUD && { revalidate: 24 * 60 * 60 }),
      tags: [
        environmentCache.tag.byId(environmentId),
        organizationCache.tag.byEnvironmentId(environmentId),
        personCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        attributeCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        displayCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        responseCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        segmentCache.tag.byEnvironmentId(environmentId),
      ],
    }
  )();
