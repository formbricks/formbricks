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
import { OperationNotAllowedError } from "@formbricks/types/errors";

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
  contactAttributes: TContactAttributes
): Promise<boolean> => {
  validateInputs(
    [contactId, ZId],
    [userId, ZString],
    [environmentId, ZId],
    [contactAttributes, ZContactAttributes]
  );

  const contactAttributeKeys = await getContactAttributeKeys(environmentId);

  const contactAttributeKeyMap = new Map(contactAttributeKeys.map((ack) => [ack.key, ack.id]));
  const upsertOperations: Promise<any>[] = [];
  const createOperations: Promise<any>[] = [];
  const newAttributes: { key: string; value: string }[] = [];

  for (const [key, value] of Object.entries(contactAttributes)) {
    const contactAttributeKeyId = contactAttributeKeyMap.get(key);

    if (contactAttributeKeyId) {
      // Class exists, perform an upsert operation
      upsertOperations.push(
        prisma.contactAttribute
          .upsert({
            select: {
              id: true,
            },
            where: {
              contactId_attributeKeyId: {
                contactId,
                attributeKeyId: contactAttributeKeyId,
              },
            },
            update: {
              value,
            },
            create: {
              contactId,
              attributeKeyId: contactAttributeKeyId,
              value,
            },
          })
          .then(() => {
            contactAttributeCache.revalidate({
              environmentId,
              contactId,
              userId,
              key,
            });
          })
      );
    } else {
      // Collect new attributes to be created later
      newAttributes.push({ key: key, value });
    }
  }

  // Execute all upsert operations concurrently
  await Promise.all(upsertOperations);

  if (newAttributes.length === 0) {
    // short-circuit if no new attributes to create
    return true;
  }

  // Check if new attribute classes will exceed the limit
  const contactAttributeKeyCount = contactAttributeKeys.length;

  const totalAttributeClassesLength = contactAttributeKeyCount + newAttributes.length;

  if (totalAttributeClassesLength > MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT) {
    throw new OperationNotAllowedError(
      `Updating these attributes would exceed the maximum number of attribute classes (${MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT}) for environment ${environmentId}. Existing attributes have been updated.`
    );
  }

  for (const { key, value } of newAttributes) {
    createOperations.push(
      prisma.contactAttributeKey
        .create({
          select: { id: true },
          data: {
            key,
            type: "custom",
            environment: {
              connect: {
                id: environmentId,
              },
            },
            attributes: {
              create: {
                contactId,
                value,
              },
            },
          },
        })
        .then(({ id }) => {
          contactAttributeKeyCache.revalidate({ id, environmentId, key });
          contactAttributeCache.revalidate({ environmentId, contactId, userId, key });
        })
    );
  }

  // Execute all create operations for new attribute classes
  await Promise.all(createOperations);

  // Revalidate the count cache
  contactAttributeKeyCache.revalidate({
    environmentId,
  });

  return true;
};
