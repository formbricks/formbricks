import { prisma } from "@formbricks/database";
import { attributeCache } from "@formbricks/lib/attribute/cache";
import { getAttributesByUserId } from "@formbricks/lib/attribute/service";
import { cache } from "@formbricks/lib/cache";
import { segmentCache } from "@formbricks/lib/cache/segment";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { displayCache } from "@formbricks/lib/display/cache";
import { getDisplaysByUserId } from "@formbricks/lib/display/service";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { personCache } from "@formbricks/lib/person/cache";
import { responseCache } from "@formbricks/lib/response/cache";
import { getResponsesByUserId } from "@formbricks/lib/response/service";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TJsPersonState } from "@formbricks/types/js";
import { getPersonSegmentIds } from "./segments";

/**
 *
 * @param environmentId - The environment id
 * @param userId - The user id
 * @param device - The device type
 * @returns The person state
 * @throws {ValidationError} - If the input is invalid
 * @throws {ResourceNotFoundError} - If the environment or organization is not found
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

      let contact = await prisma.contact.findFirst({
        where: {
          attributes: {
            some: {
              attributeKey: {
                key: "userId",
                environmentId,
              },
              value: userId,
            },
          },
        },
      });

      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            environment: {
              connect: {
                id: environmentId,
              },
            },
            attributes: {
              create: [
                {
                  attributeKey: {
                    connect: { key: "userId", environmentId },
                  },
                  value: userId,
                },
              ],
            },
          },
        });

        revalidatePerson = true;
      }

      const contactResponses = await prisma.response.findMany({
        where: {
          contactId: contact.id,
        },
        select: {
          surveyId: true,
        },
      });
      // const personDisplays = await getDisplaysByUserId(environmentId, userId);
      const contactDisplayes = await prisma.display.findMany({
        where: {
          contactId: contact.id,
        },
        select: {
          surveyId: true,
          createdAt: true,
        },
      });
      const segments = await getPersonSegmentIds(environmentId, contact, device);
      const attributes = await getAttributesByUserId(environmentId, userId);

      // If the person exists, return the persons's state
      const userState: TJsPersonState["data"] = {
        userId: contact.userId,
        segments,
        displays:
          personDisplays?.map((display) => ({ surveyId: display.surveyId, createdAt: display.createdAt })) ??
          [],
        responses: contactResponses?.map((response) => response.surveyId) ?? [],
        attributes,
        lastDisplayAt:
          personDisplays.length > 0
            ? personDisplays.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
            : null,
      };

      return {
        state: userState,
        revalidateProps: revalidatePerson ? { personId: contact.id, revalidate: true } : undefined,
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
