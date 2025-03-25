import { contactCache } from "@/lib/cache/contact";
import { contactAttributeCache } from "@/lib/cache/contact-attribute";
import { contactAttributeKeyCache } from "@/lib/cache/contact-attribute-key";
import { TContactBulkUploadContact } from "@/modules/ee/contacts/types/contact";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";

export const upsertBulkContacts = async (
  contacts: TContactBulkUploadContact[],
  environmentId: string,
  parsedEmails: string[]
): Promise<{
  contactIdxWithConflictingUserIds: number[];
}> => {
  const contactIdxWithConflictingUserIds: number[] = [];

  const userIdsInContacts = contacts.flatMap((contact) =>
    contact.attributes.filter((attr) => attr.attributeKey.key === "userId").map((attr) => attr.value)
  );

  const existingUserIds = await prisma.contactAttribute.findMany({
    where: {
      attributeKey: {
        environmentId,
        key: "userId",
      },
      value: {
        in: userIdsInContacts,
      },
    },
    select: {
      value: true,
    },
  });

  // in the contacts array, skip the contacts that have an existing userId attribute
  const filteredContacts = contacts.filter((contact, idx) => {
    const userIdAttr = contact.attributes.find((attr) => attr.attributeKey.key === "userId");
    if (!userIdAttr) {
      return true;
    }

    // check if the userId exists in the existingUserIds array
    const existingUserId = existingUserIds.find(
      (existingUserId) => existingUserId.value === userIdAttr.value
    );

    if (existingUserId) {
      contactIdxWithConflictingUserIds.push(idx);
    }

    return !existingUserId;
  });

  const emailKey = "email";

  // Get unique attribute keys from the payload
  const keys = Array.from(
    new Set(filteredContacts.flatMap((contact) => contact.attributes.map((attr) => attr.attributeKey.key)))
  );

  // Fetch attribute key records for these keys in this environment
  const attributeKeys = await prisma.contactAttributeKey.findMany({
    where: {
      key: { in: keys },
      environmentId,
    },
  });

  const attributeKeyMap = attributeKeys.reduce<Record<string, string>>((acc, keyObj) => {
    acc[keyObj.key] = keyObj.id;
    return acc;
  }, {});

  // Check for missing attribute keys and create them if needed.
  const missingKeysMap = new Map<string, { key: string; name: string }>();
  for (const contact of filteredContacts) {
    for (const attr of contact.attributes) {
      if (!attributeKeyMap[attr.attributeKey.key]) {
        missingKeysMap.set(attr.attributeKey.key, attr.attributeKey);
      }
    }
  }

  // Find existing contacts by matching email attribute
  const existingContacts = await prisma.contact.findMany({
    where: {
      environmentId,
      attributes: {
        some: {
          attributeKey: { key: emailKey },
          value: { in: parsedEmails },
        },
      },
    },
    select: {
      attributes: {
        select: {
          attributeKey: { select: { key: true } },
          createdAt: true,
          id: true,
          value: true,
        },
      },
      id: true,
    },
  });

  // Build a map from email to contact id (if the email attribute exists)
  const contactMap = new Map<
    string,
    { contactId: string; attributes: { id: string; attributeKey: { key: string }; createdAt: Date }[] }
  >();

  existingContacts.forEach((contact) => {
    const emailAttr = contact.attributes.find((attr) => attr.attributeKey.key === emailKey);

    if (emailAttr) {
      contactMap.set(emailAttr.value, {
        contactId: contact.id,
        attributes: contact.attributes.map((attr) => ({
          id: attr.id,
          attributeKey: { key: attr.attributeKey.key },
          createdAt: attr.createdAt,
        })),
      });
    }
  });

  // Split contacts into ones to update and ones to create
  const contactsToUpdate: {
    contactId: string;
    attributes: {
      id: string;
      createdAt: Date;
      value: string;
      attributeKey: {
        key: string;
      };
    }[];
  }[] = [];

  const contactsToCreate: {
    attributes: {
      value: string;
      attributeKey: {
        key: string;
      };
    }[];
  }[] = [];

  for (const contact of filteredContacts) {
    const emailAttr = contact.attributes.find((attr) => attr.attributeKey.key === emailKey);

    if (emailAttr && contactMap.has(emailAttr.value)) {
      contactsToUpdate.push({
        contactId: contactMap.get(emailAttr.value)!.contactId,
        attributes: contact.attributes.map((attr) => {
          const existingAttr = contactMap
            .get(emailAttr.value)!
            .attributes.find((a) => a.attributeKey.key === attr.attributeKey.key);

          if (!existingAttr) {
            // Should never happen, just to be safe and satisfy typescript
            return {
              id: createId(),
              createdAt: new Date(),
              value: attr.value,
              attributeKey: attr.attributeKey,
            };
          }

          return {
            id: existingAttr.id,
            createdAt: existingAttr.createdAt,
            value: attr.value,
            attributeKey: attr.attributeKey,
          };
        }),
      });
    } else {
      contactsToCreate.push(contact);
    }
  }

  // Execute everything in ONE transaction
  await prisma.$transaction(async (tx) => {
    // Create missing attribute keys if needed
    if (missingKeysMap.size > 0) {
      const missingKeysArray = Array.from(missingKeysMap.values());
      const newAttributeKeys = await tx.contactAttributeKey.createManyAndReturn({
        data: missingKeysArray.map((keyObj) => ({
          key: keyObj.key,
          name: keyObj.name,
          environmentId,
        })),
        select: { key: true, id: true },
        skipDuplicates: true,
      });

      // Refresh the attribute key map for the missing keys
      for (const attrKey of newAttributeKeys) {
        attributeKeyMap[attrKey.key] = attrKey.id;
      }
    }

    // Create new contacts
    const newContacts = contactsToCreate.map(() => ({
      id: createId(),
      environmentId,
    }));

    if (newContacts.length > 0) {
      await tx.contact.createMany({
        data: newContacts,
      });
    }

    // Prepare attributes for both new and existing contacts
    const attributesUpsertForCreatedUsers = contactsToCreate.flatMap((contact, idx) =>
      contact.attributes.map((attr) => ({
        id: createId(),
        contactId: newContacts[idx].id,
        attributeKeyId: attributeKeyMap[attr.attributeKey.key],
        value: attr.value,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );

    const attributesUpsertForExistingUsers = contactsToUpdate.flatMap((contact) =>
      contact.attributes.map((attr) => ({
        id: attr.id,
        contactId: contact.contactId,
        attributeKeyId: attributeKeyMap[attr.attributeKey.key],
        value: attr.value,
        createdAt: attr.createdAt,
        updatedAt: new Date(),
      }))
    );

    const attributesToUpsert = [...attributesUpsertForCreatedUsers, ...attributesUpsertForExistingUsers];

    // Skip the raw query if there are no attributes to upsert
    if (attributesToUpsert.length > 0) {
      // Use a raw query to perform a bulk insert with an ON CONFLICT clause
      await tx.$executeRaw`
          INSERT INTO "ContactAttribute" (
            "id", "created_at", "updated_at", "contactId", "value", "attributeKeyId"
          )
          SELECT 
            unnest(${Prisma.sql`ARRAY[${attributesToUpsert.map((a) => a.id)}]`}),
            unnest(${Prisma.sql`ARRAY[${attributesToUpsert.map((a) => a.createdAt)}]`}),
            unnest(${Prisma.sql`ARRAY[${attributesToUpsert.map((a) => a.updatedAt)}]`}),
            unnest(${Prisma.sql`ARRAY[${attributesToUpsert.map((a) => a.contactId)}]`}),
            unnest(${Prisma.sql`ARRAY[${attributesToUpsert.map((a) => a.value)}]`}),
            unnest(${Prisma.sql`ARRAY[${attributesToUpsert.map((a) => a.attributeKeyId)}]`})
          ON CONFLICT ("contactId", "attributeKeyId") DO UPDATE SET
            "value" = EXCLUDED."value",
            "updated_at" = EXCLUDED."updated_at"
        `;
    }

    contactCache.revalidate({
      environmentId,
    });

    // revalidate all the new contacts:
    for (const newContact of newContacts) {
      contactCache.revalidate({
        id: newContact.id,
      });
    }

    // revalidate all the existing contacts:
    for (const existingContact of existingContacts) {
      contactCache.revalidate({
        id: existingContact.id,
      });
    }

    contactAttributeKeyCache.revalidate({
      environmentId,
    });

    contactAttributeCache.revalidate({ environmentId });
  });

  return {
    contactIdxWithConflictingUserIds,
  };
};
