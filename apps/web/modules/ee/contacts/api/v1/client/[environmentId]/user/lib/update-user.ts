import { createCacheKey } from "@/modules/cache/lib/cacheKeys";
import { withCache } from "@/modules/cache/lib/withCache";
import { updateAttributes } from "@/modules/ee/contacts/lib/attributes";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TJsPersonState } from "@formbricks/types/js";
import { getPersonSegmentIds } from "./segments";

/**
 * Cached environment lookup - environments rarely change
 */
const getEnvironment = (environmentId: string) =>
  withCache(
    async () => {
      return prisma.environment.findUnique({
        where: { id: environmentId },
        select: { id: true, type: true },
      });
    },
    {
      key: createCacheKey.environment.config(environmentId),
      ttl: 60 * 60 * 1000, // 1 hour TTL in milliseconds - environments rarely change
    }
  )();

/**
 * Comprehensive contact data fetcher - gets everything needed in one query
 * Eliminates redundant queries by fetching contact + user state data together
 */
const getContactWithFullData = async (environmentId: string, userId: string) => {
  return prisma.contact.findFirst({
    where: {
      environmentId,
      attributes: {
        some: {
          attributeKey: { key: "userId", environmentId },
          value: userId,
        },
      },
    },
    select: {
      id: true,
      attributes: {
        select: {
          attributeKey: { select: { key: true } },
          value: true,
        },
      },
      // Include user state data in the same query
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
 * Creates contact with comprehensive data structure
 */
const createContact = async (environmentId: string, userId: string) => {
  return prisma.contact.create({
    data: {
      environment: {
        connect: { id: environmentId },
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
        select: {
          attributeKey: { select: { key: true } },
          value: true,
        },
      },
      // Include empty arrays for new contacts
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
 * Build user state from already-fetched contact data
 * Eliminates the need for separate getUserState query
 */
const buildUserStateFromContact = async (
  contactData: NonNullable<Awaited<ReturnType<typeof getContactWithFullData>>>,
  environmentId: string,
  userId: string,
  device: "phone" | "desktop",
  attributes: Record<string, string>
) => {
  // Get segments (only remaining external call)
  // Ensure segments is always an array to prevent "segments is not iterable" error
  let segments: string[] = [];
  try {
    segments = await getPersonSegmentIds(environmentId, contactData.id, userId, attributes, device);
    // Double-check that segments is actually an array
    if (!Array.isArray(segments)) {
      segments = [];
    }
  } catch (error) {
    // If segments fetching fails, use empty array as fallback
    segments = [];
  }

  // Process data efficiently from already-fetched contact
  const displays = contactData.displays.map((display) => ({
    surveyId: display.surveyId,
    createdAt: display.createdAt,
  }));

  const responses = contactData.responses.map((response) => response.surveyId);

  const lastDisplayAt = contactData.displays.length > 0 ? contactData.displays[0].createdAt : null;

  return {
    contactId: contactData.id,
    userId,
    segments,
    displays,
    responses,
    lastDisplayAt,
  };
};

export const updateUser = async (
  environmentId: string,
  userId: string,
  device: "phone" | "desktop",
  attributes?: Record<string, string>
): Promise<{ state: TJsPersonState; messages?: string[] }> => {
  // Cached environment validation (rarely changes)
  const environment = await getEnvironment(environmentId);
  if (!environment) {
    throw new ResourceNotFoundError(`environment`, environmentId);
  }

  // Single comprehensive query - gets contact + user state data
  let contactData = await getContactWithFullData(environmentId, userId);

  // Create contact if doesn't exist
  if (!contactData) {
    contactData = await createContact(environmentId, userId);
  }

  // Process contact attributes efficiently (single pass)
  let contactAttributes = contactData.attributes.reduce(
    (acc, ctx) => {
      acc[ctx.attributeKey.key] = ctx.value;
      return acc;
    },
    {} as Record<string, string>
  );

  let messages: string[] = [];
  let language = contactAttributes.language;

  // Handle attribute updates efficiently
  if (attributes && Object.keys(attributes).length > 0) {
    // Single pass comparison - check if any attribute has changed
    const hasChanges = Object.entries(attributes).some(([key, value]) => value !== contactAttributes[key]);

    if (hasChanges) {
      const {
        success,
        messages: updateAttrMessages,
        ignoreEmailAttribute,
      } = await updateAttributes(contactData.id, userId, environmentId, attributes);

      messages = updateAttrMessages ?? [];

      // Update local attributes if successful
      if (success) {
        let attributesToUpdate = { ...attributes };

        if (ignoreEmailAttribute) {
          const { email, ...rest } = attributes;
          attributesToUpdate = rest;
        }

        contactAttributes = {
          ...contactAttributes,
          ...attributesToUpdate,
        };

        if (attributes.language) {
          language = attributes.language;
        }
      }
    }
  }

  // Build user state from already-fetched data (no additional query needed)
  const userStateData = await buildUserStateFromContact(
    contactData,
    environmentId,
    userId,
    device,
    contactAttributes
  );

  return {
    state: {
      data: {
        ...userStateData,
        language,
      },
      expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 minutes
    },
    messages,
  };
};
