import { contactCache } from "@/lib/cache/contact";
import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { getContactByUserId } from "@/modules/ee/contacts/api/client/[environmentId]/identify/contacts/[userId]/lib/contact";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { segmentCache } from "@formbricks/lib/cache/segment";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { displayCache } from "@formbricks/lib/display/cache";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { organizationCache } from "@formbricks/lib/organization/cache";
import { getOrganizationByEnvironmentId } from "@formbricks/lib/organization/service";
import { responseCache } from "@formbricks/lib/response/cache";
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
}): Promise<{
  state: TJsPersonState["data"];
  revalidateProps?: { contactId: string; revalidate: boolean };
}> =>
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

      let contact = await getContactByUserId(environmentId, userId);

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
                    connect: { key_environmentId: { key: "userId", environmentId } },
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

      const contactDisplayes = await prisma.display.findMany({
        where: {
          contactId: contact.id,
        },
        select: {
          surveyId: true,
          createdAt: true,
        },
      });

      const segments = await getPersonSegmentIds(environmentId, contact.id, userId, device);

      // If the person exists, return the persons's state
      const userState: TJsPersonState["data"] = {
        userId,
        segments,
        displays:
          contactDisplayes?.map((display) => ({
            surveyId: display.surveyId,
            createdAt: display.createdAt,
          })) ?? [],
        responses: contactResponses?.map((response) => response.surveyId) ?? [],
        lastDisplayAt:
          contactDisplayes.length > 0
            ? contactDisplayes.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
            : null,
      };

      return {
        state: userState,
        revalidateProps: revalidatePerson ? { contactId: contact.id, revalidate: true } : undefined,
      };
    },
    [`personState-${environmentId}-${userId}-${device}`],
    {
      ...(IS_FORMBRICKS_CLOUD && { revalidate: 24 * 60 * 60 }),
      tags: [
        environmentCache.tag.byId(environmentId),
        organizationCache.tag.byEnvironmentId(environmentId),
        contactCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        contactAttributeCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        displayCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        responseCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        segmentCache.tag.byEnvironmentId(environmentId),
      ],
    }
  )();
