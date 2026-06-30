import { prisma } from "@formbricks/database";
import { normalizeLanguageCode } from "@formbricks/i18n-utils/src/canonical";
import { TContactAttributesInput } from "@formbricks/types/contact-attribute";
import { TJsPersonState } from "@formbricks/types/js";
import { toLegacyLanguageCodes } from "@/lib/i18n/utils";
import { formatAttributeMessage, updateAttributes } from "@/modules/ee/contacts/lib/attributes";
import { getPersonSegmentIds } from "./segments";

/**
 * Comprehensive contact data fetcher - gets everything needed in one query
 * Eliminates redundant queries by fetching contact + user state data together
 */
const getContactWithFullData = async (workspaceId: string, userId: string) => {
  return prisma.contact.findFirst({
    where: {
      workspaceId,
      attributes: {
        some: {
          attributeKey: { key: "userId", workspaceId },
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
const createContact = async (workspaceId: string, userId: string) => {
  return prisma.contact.create({
    data: {
      workspace: {
        connect: { id: workspaceId },
      },
      attributes: {
        create: [
          {
            attributeKey: {
              connect: { key_workspaceId: { key: "userId", workspaceId } },
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
  workspaceId: string,
  userId: string,
  device: "phone" | "desktop"
) => {
  // Get segments (only remaining external call)
  // Ensure segments is always an array to prevent "segments is not iterable" error
  let segments: string[] = [];
  try {
    segments = await getPersonSegmentIds(workspaceId, contactData.id, userId, device);
    // Double-check that segments is actually an array
    if (!Array.isArray(segments)) {
      segments = [];
    }
  } catch {
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
  workspaceId: string,
  userId: string,
  device: "phone" | "desktop",
  attributes?: TContactAttributesInput
): Promise<{ state: TJsPersonState; messages?: string[]; errors?: string[] }> => {
  // Single comprehensive query - gets contact + user state data
  let contactData = await getContactWithFullData(workspaceId, userId);

  // Create contact if doesn't exist
  if (!contactData) {
    contactData = await createContact(workspaceId, userId);
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
  let errors: string[] = [];
  let language = contactAttributes.language;

  // Standardize the contact's `language` attribute to its canonical BCP-47 tag on write (ENG-1067), so
  // a legacy SDK `setLanguage("de")` lands as `de-DE` instead of re-introducing legacy codes. The
  // canonical value is also what we echo back in the response state below, so the SDK self-heals its
  // cached copy. Unresolvable values are left untouched.
  const canonicalLanguage = attributes?.language ? normalizeLanguageCode(String(attributes.language)) : null;
  const normalizedAttributes =
    canonicalLanguage && attributes ? { ...attributes, language: canonicalLanguage } : attributes;

  // Handle attribute updates efficiently
  if (normalizedAttributes && Object.keys(normalizedAttributes).length > 0) {
    // Single pass comparison - check if any attribute has changed
    const hasChanges = Object.entries(normalizedAttributes).some(
      ([key, value]) => value !== contactAttributes[key]
    );

    if (hasChanges) {
      const {
        success,
        messages: updateAttrMessages,
        errors: updateAttrErrors,
      } = await updateAttributes(contactData.id, userId, workspaceId, normalizedAttributes);

      messages = updateAttrMessages?.map(formatAttributeMessage) ?? [];
      errors = updateAttrErrors?.map(formatAttributeMessage) ?? [];

      // Update language if provided (used in response state)
      if (success && normalizedAttributes.language) {
        language = String(normalizedAttributes.language);
      }
    }
  }

  // Build user state from already-fetched data (no additional query needed)
  const userStateData = await buildUserStateFromContact(contactData, workspaceId, userId, device);

  // Transitional SDK back-compat (ENG-1067): de-canonicalize the language echoed back to the SDK to a
  // legacy form (the first known alias), matching the legacy codes the client environment serializer
  // exposes, so SDK clients that match the display language by exact code keep working until the
  // canonical-aware versions are adopted (notably older React Native apps). The DB stays canonical
  // (normalized on write above) — only the wire is legacy. Remove once those clients have drained.
  const responseLanguage = language ? (toLegacyLanguageCodes(language)[0] ?? language) : language;

  return {
    state: {
      data: {
        ...userStateData,
        language: responseLanguage,
      },
      expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 minutes
    },
    messages: messages.length > 0 ? messages : undefined,
    errors: errors.length > 0 ? errors : undefined,
  };
};
