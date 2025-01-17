import { contactCache } from "@/lib/cache/contact";
import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { updateAttributes } from "@/modules/ee/contacts/api/client/[environmentId]/contacts/[userId]/attributes/lib/attributes";
import { getContactByUserIdWithAttributes } from "@/modules/ee/contacts/api/client/[environmentId]/contacts/[userId]/attributes/lib/contact";
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
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TJsPersonState } from "@formbricks/types/js";
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
export const getPersonState = async ({
  environmentId,
  userId,
  device,
  attributes,
}: {
  environmentId: string;
  userId: string;
  device: "phone" | "desktop";
  attributes?: TContactAttributes;
}): Promise<{
  state: TJsPersonState["data"];
  updateAttrResponse: {
    success: boolean;
    details?: Record<string, string>;
  } | null;
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

      let contact = await getContactByUserIdWithAttributes(environmentId, userId, attributes ?? {});

      if (!contact) {
        // If the contact does not exist, create it
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

      let updateAttrResponse: {
        success: boolean;
        details?: Record<string, string>;
      } | null = null;

      // Update the contact attributes
      if (attributes && Object.keys(attributes).length > 0) {
        const oldAttributes = new Map(contact.attributes.map((attr) => [attr.attributeKey.key, attr.value]));

        let isUpToDate = true;
        for (const [key, value] of Object.entries(attributes)) {
          if (value !== oldAttributes.get(key)) {
            isUpToDate = false;
            break;
          }
        }

        if (isUpToDate) {
          updateAttrResponse = {
            success: true,
            details: {
              message: "No updates were necessary; the person is already up to date.",
            },
          };
        } else {
          updateAttrResponse = await updateAttributes(contact.id, userId, environmentId, attributes);
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
        updateAttrResponse,
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
        contactAttributeKeyCache.tag.byEnvironmentId(environmentId),
        displayCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        responseCache.tag.byEnvironmentIdAndUserId(environmentId, userId),
        segmentCache.tag.byEnvironmentId(environmentId),
      ],
    }
  )();
