import { contactCache } from "@/lib/cache/contact";
import { contactAttributeCache } from "@/lib/cache/contact-attribute";
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
import { getContactByUserIdWithAttributes } from "./contact";
import { getPersonSegmentIds } from "./segments";

/**
 *
 * @param environmentId - The environment id
 * @param userId - The user id
 * @param device - The device type
 * @param attributes - The attributes to update
 * @returns The person state
 * @throws {ValidationError} - If the input is invalid
 * @throws {ResourceNotFoundError} - If the environment or organization is not found
 */
export const getUserState = async ({
  environmentId,
  userId,
  device,
  attributes,
}: {
  environmentId: string;
  userId: string;
  device: "phone" | "desktop";
  attributes?: Record<string, string>;
}): Promise<{
  state: TJsPersonState["data"];
  attributesInfo: {
    shouldUpdate: boolean;
    contactId: string;
  };
  revalidateProps?: { contactId: string; revalidate: boolean };
}> =>
  cache(
    async () => {
      let revalidatePerson = false;
      let attributesUpToDate = true;
      const environment = await getEnvironment(environmentId);

      if (!environment) {
        throw new ResourceNotFoundError(`environment`, environmentId);
      }

      const organization = await getOrganizationByEnvironmentId(environmentId);

      if (!organization) {
        throw new ResourceNotFoundError(`organization`, environmentId);
      }

      let contact = await getContactByUserIdWithAttributes(environmentId, userId, attributes ?? {});

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
          select: {
            id: true,
            attributes: {
              where: {
                attributeKey: {
                  key: {
                    in: Object.keys(attributes ?? {}),
                  },
                },
              },
              select: { attributeKey: { select: { key: true } }, value: true },
            },
          },
        });

        revalidatePerson = true;
      }

      if (attributes && Object.keys(attributes).length > 0) {
        const oldAttributes = contact.attributes.reduce(
          (acc, ctx) => {
            acc[ctx.attributeKey.key] = ctx.value;
            return acc;
          },
          {} as Record<string, string>
        );

        for (const [key, value] of Object.entries(attributes)) {
          if (value !== oldAttributes[key]) {
            attributesUpToDate = false;
            break;
          }
        }
      }

      const contactResponses = await prisma.response.findMany({
        where: {
          contactId: contact.id,
        },
        select: {
          surveyId: true,
        },
      });

      const contactDisplays = await prisma.display.findMany({
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
          contactDisplays?.map((display) => ({
            surveyId: display.surveyId,
            createdAt: display.createdAt,
          })) ?? [],
        responses: contactResponses?.map((response) => response.surveyId) ?? [],
        lastDisplayAt:
          contactDisplays.length > 0
            ? contactDisplays.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
            : null,
      };

      return {
        state: userState,
        attributesInfo: {
          shouldUpdate: !attributesUpToDate,
          contactId: contact.id,
        },
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
