import { prisma } from "@formbricks/database";
import { TJsPersonState } from "@formbricks/types/js";
import { getPersonSegmentIds } from "./segments";

/**
 * Optimized single query to get all user state data
 * Replaces multiple separate queries with one efficient query
 */
const getUserStateDataOptimized = async (contactId: string) => {
  return prisma.contact.findUniqueOrThrow({
    where: { id: contactId },
    select: {
      id: true,
      responses: {
        select: { surveyId: true },
      },
      displays: {
        select: {
          surveyId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
};

/**
 * Optimized user state fetcher without caching
 * Uses single database query and efficient data processing
 * NO CACHING - user state changes frequently with contact updates
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
}): Promise<TJsPersonState["data"]> => {
  // Single optimized query for all contact data
  const contactData = await getUserStateDataOptimized(contactId);

  // Get segments (this might have its own optimization)
  const segments = await getPersonSegmentIds(environmentId, contactId, userId, attributes, device);

  // Process displays efficiently
  const displays = (contactData.displays ?? []).map((display) => ({
    surveyId: display.surveyId,
    createdAt: display.createdAt,
  }));

  // Get latest display date
  const lastDisplayAt =
    contactData.displays && contactData.displays.length > 0 ? contactData.displays[0].createdAt : null;

  // Process responses efficiently
  const responses = (contactData.responses ?? []).map((response) => response.surveyId);

  const userState: TJsPersonState["data"] = {
    contactId,
    userId,
    segments,
    displays,
    responses,
    lastDisplayAt,
  };

  return userState;
};
