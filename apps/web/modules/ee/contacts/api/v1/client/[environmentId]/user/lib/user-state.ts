import { cache } from "@/lib/cache";
import { contactCache } from "@/lib/cache/contact";
import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { segmentCache } from "@/lib/cache/segment";
import { displayCache } from "@/lib/display/cache";
import { environmentCache } from "@/lib/environment/cache";
import { organizationCache } from "@/lib/organization/cache";
import { responseCache } from "@/lib/response/cache";
import { prisma } from "@formbricks/database";
import { TJsPersonState } from "@formbricks/types/js";
import { getPersonSegmentIds } from "./segments";

/**
 *
 * @param environmentId - The environment id
 * @param userId - The user id
 * @param device - The device type
 * @param attributes - The contact attributes
 * @returns The person state
 * @throws {ValidationError} - If the input is invalid
 * @throws {ResourceNotFoundError} - If the environment or organization is not found
 */
export const getUserState = async ({
  environmentId,
  userId,
  contactId,
  device,
  attributes,
}: {
  environmentId: string;
  userId: string;
  contactId: string;
  device: "phone" | "desktop";
  attributes: Record<string, string>;
}): Promise<TJsPersonState["data"]> =>
  cache(
    async () => {
      const contactResponses = await prisma.response.findMany({
        where: {
          contactId,
        },
        select: {
          surveyId: true,
        },
      });

      const contactDisplays = await prisma.display.findMany({
        where: {
          contactId,
        },
        select: {
          surveyId: true,
          createdAt: true,
        },
      });

      const segments = await getPersonSegmentIds(environmentId, contactId, userId, attributes, device);

      // If the person exists, return the persons's state
      const userState: TJsPersonState["data"] = {
        contactId,
        userId,
        segments,
        displays:
          contactDisplays?.map((display) => ({
            surveyId: display.surveyId,
            createdAt: display.createdAt,
          })) ?? [],
        responses: contactResponses?.map((response) => response.surveyId) ?? [],
        lastDisplayAt:
          contactDisplays?.length > 0
            ? contactDisplays.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
            : null,
      };

      return userState;
    },
    [`personState-${environmentId}-${userId}-${device}`],
    {
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
