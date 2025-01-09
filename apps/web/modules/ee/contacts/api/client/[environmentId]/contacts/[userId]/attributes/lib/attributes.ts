import "server-only";
import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "@formbricks/lib/constants";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId, ZString } from "@formbricks/types/common";
import { TContactAttributes, ZContactAttributes } from "@formbricks/types/contact-attribute";

export const getContactAttributeKeys = reactCache((environmentId: string) =>
  cache(
    async () => {
      validateInputs([environmentId, ZId]);

      const contactAttributes = await prisma.contactAttributeKey.findMany({
        where: {
          environmentId,
        },
        select: {
          id: true,
          key: true,
        },
      });

      return contactAttributes;
    },
    [`getContactAttributeKeys-attributes-api-${environmentId}`],
    {
      tags: [contactAttributeKeyCache.tag.byEnvironmentId(environmentId)],
    }
  )()
);

export const updateAttributes = async (
  contactId: string,
  userId: string,
  environmentId: string,
  contactAttributesParam: TContactAttributes
): Promise<{ success: boolean; details?: Record<string, string> }> => {
  validateInputs(
    [contactId, ZId],
    [userId, ZString],
    [environmentId, ZId],
    [contactAttributesParam, ZContactAttributes]
  );

  // Fetch contact attribute keys and email check in parallel
  const [contactAttributeKeys, existingEmailAttribute] = await Promise.all([
    getContactAttributeKeys(environmentId),
    contactAttributesParam.email
      ? prisma.contactAttribute.findFirst({
          where: {
            AND: [
              {
                attributeKey: {
                  key: "email",
                },
                value: contactAttributesParam.email,
              },
              {
                NOT: {
                  contactId,
                },
              },
            ],
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  // Process email existence early
  const { email, ...remainingAttributes } = contactAttributesParam;
  const contactAttributes = existingEmailAttribute ? remainingAttributes : contactAttributesParam;
  const emailExists = !!existingEmailAttribute;

  // Create lookup map for attribute keys
  const contactAttributeKeyMap = new Map(contactAttributeKeys.map((ack) => [ack.key, ack]));

  // Separate existing and new attributes in a single pass
  const { existingAttributes, newAttributes } = Object.entries(contactAttributes).reduce(
    (acc, [key, value]) => {
      const attributeKey = contactAttributeKeyMap.get(key);
      if (attributeKey) {
        acc.existingAttributes.push({ key, value, attributeKeyId: attributeKey.id });
      } else {
        acc.newAttributes.push({ key, value });
      }
      return acc;
    },
    { existingAttributes: [], newAttributes: [] } as {
      existingAttributes: { key: string; value: string; attributeKeyId: string }[];
      newAttributes: { key: string; value: string }[];
    }
  );

  let details: Record<string, string> = emailExists
    ? { email: "The email already exists for this environment and was not updated." }
    : {};

  // First, update all existing attributes
  if (existingAttributes.length > 0) {
    await prisma.$transaction(
      existingAttributes.map(({ attributeKeyId, value }) =>
        prisma.contactAttribute.upsert({
          where: {
            contactId_attributeKeyId: {
              contactId,
              attributeKeyId,
            },
          },
          update: { value },
          create: {
            contactId,
            attributeKeyId,
            value,
          },
        })
      )
    );

    // Revalidate cache for existing attributes
    existingAttributes.map(({ key }) =>
      contactAttributeCache.revalidate({ environmentId, contactId, userId, key })
    );
  }

  // Then, try to create new attributes if any exist
  if (newAttributes.length > 0) {
    const totalAttributeClassesLength = contactAttributeKeys.length + newAttributes.length;

    if (totalAttributeClassesLength > MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT) {
      // Add warning to details about skipped attributes
      details = {
        ...details,
        newAttributes: `Could not create ${newAttributes.length} new attribute(s) as it would exceed the maximum limit of ${MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT} attribute classes. Existing attributes were updated successfully.`,
      };
    } else {
      // Create new attributes since we're under the limit
      await prisma.$transaction(
        newAttributes.map(({ key, value }) =>
          prisma.contactAttributeKey.create({
            data: {
              key,
              type: "custom",
              environment: { connect: { id: environmentId } },
              attributes: {
                create: { contactId, value },
              },
            },
          })
        )
      );

      // Batch revalidate caches for new attributes
      newAttributes.forEach(({ key }) => {
        contactAttributeKeyCache.revalidate({ environmentId, key });
        contactAttributeCache.revalidate({ environmentId, contactId, userId, key });
      });
      contactAttributeKeyCache.revalidate({ environmentId });
    }
  }

  return {
    success: true,
    ...(Object.keys(details).length > 0 ? { details } : {}),
  };
};
