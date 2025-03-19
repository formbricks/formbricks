import { transformErrorToDetails } from "@/app/lib/api/validator";
import { responses } from "@/modules/api/v2/lib/response";
import { authenticateRequest } from "@/modules/api/v2/management/auth/authenticate-request";
import { ZContactBulkUploadRequest } from "@/modules/ee/contacts/types/contact";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { ZUserEmail } from "@formbricks/types/user";

export const PUT = async (request: NextRequest) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication.ok) return responses.unauthorizedResponse();

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse();
    }

    const json = await request.json();
    const parsedInput = ZContactBulkUploadRequest.safeParse(json);

    if (!parsedInput.success) {
      const details = Object.entries(transformErrorToDetails(parsedInput.error)).map(([field, issue]) => ({
        field,
        issue,
      }));

      return responses.badRequestResponse({
        details,
      });
    }

    const { contacts } = parsedInput.data;
    const { environmentId } = authentication.data;

    const emailKey = "email";

    const seenEmails = new Set<string>();
    const duplicateEmails = new Set<string>();

    for (const contact of contacts) {
      const email = contact.attributes.find((attr) => attr.attributeKey.key === emailKey)?.value;

      if (email) {
        if (seenEmails.has(email)) {
          duplicateEmails.add(email);
        } else {
          seenEmails.add(email);
        }
      }
    }

    // Filter out any contacts that have a duplicate email.
    // All contacts with an email that appears more than once will be excluded.
    const filteredContactsByEmail = contacts.filter((contact) => {
      const email = contact.attributes.find((attr) => attr.attributeKey.key === emailKey)?.value;
      return email && !duplicateEmails.has(email);
    });

    if (filteredContactsByEmail.length === 0) {
      return responses.badRequestResponse({
        details: [
          { field: "contacts", issue: "No valid contacts to process after filtering duplicate emails" },
        ],
      });
    }

    // duplicate userIds
    const seenUserIds = new Set<string>();
    const duplicateUserIds = new Set<string>();

    for (const contact of filteredContactsByEmail) {
      const userId = contact.attributes.find((attr) => attr.attributeKey.key === "userId")?.value;

      if (userId) {
        if (seenUserIds.has(userId)) {
          duplicateUserIds.add(userId);
        } else {
          seenUserIds.add(userId);
        }
      }
    }

    // userIds need to be unique, so we get rid of all the contacts with duplicate userIds
    const filteredContacts = filteredContactsByEmail.filter((contact) => {
      const userId = contact.attributes.find((attr) => attr.attributeKey.key === "userId")?.value;
      if (userId) {
        return !duplicateUserIds.has(userId);
      }

      return true;
    });

    if (filteredContacts.length === 0) {
      return responses.badRequestResponse({
        details: [
          { field: "contacts", issue: "No valid contacts to process after filtering duplicate userIds" },
        ],
      });
    }

    const emails = filteredContacts
      .map((contact) => contact.attributes.find((attr) => attr.attributeKey.key === emailKey)?.value)
      .filter((email): email is string => Boolean(email));

    if (!emails.length) {
      return responses.badRequestResponse({
        details: [{ field: "contacts", issue: "No email found for any contact, please check your contacts" }],
      });
    }

    const parsedEmails = z.array(ZUserEmail).safeParse(emails);
    if (!parsedEmails.success) {
      return responses.badRequestResponse({
        details: [
          { field: "contacts", issue: "Invalid email found for some contacts, please check your contacts" },
        ],
      });
    }

    // Get unique attribute keys from the payload
    const keys = Array.from(
      new Set(filteredContacts.flatMap((contact) => contact.attributes.map((attr) => attr.attributeKey.key)))
    );

    // 2. Fetch attribute key records for these keys in this environment
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

    // 2a. Check for missing attribute keys and create them if needed.
    const missingKeysMap = new Map<string, { key: string; name: string }>();
    filteredContacts.forEach((contact) => {
      contact.attributes.forEach((attr) => {
        // If the attribute key from the payload is not found, add it.
        if (!attributeKeyMap[attr.attributeKey.key]) {
          missingKeysMap.set(attr.attributeKey.key, attr.attributeKey);
        }
      });
    });

    if (missingKeysMap.size > 0) {
      const missingKeysArray = Array.from(missingKeysMap.values());
      // Create missing attribute keys in a batch
      await prisma.contactAttributeKey.createMany({
        data: missingKeysArray.map((keyObj) => ({
          key: keyObj.key,
          name: keyObj.name,
          environmentId,
        })),
        skipDuplicates: true,
      });

      // Refresh the attribute key map for the missing keys
      const newAttributeKeys = await prisma.contactAttributeKey.findMany({
        where: {
          key: { in: missingKeysArray.map((k) => k.key) },
          environmentId,
        },
        select: { key: true, id: true },
      });

      newAttributeKeys.forEach((attrKey) => {
        attributeKeyMap[attrKey.key] = attrKey.id;
      });
    }

    // 3. Find existing contacts by matching email attribute
    const existingContacts = await prisma.contact.findMany({
      where: {
        environmentId,
        attributes: {
          some: {
            attributeKey: { key: emailKey },
            value: { in: parsedEmails.data },
          },
        },
      },
      include: { attributes: { include: { attributeKey: true } } },
    });

    // Build a map from email to contact id (if the email attribute exists)
    const contactMap = new Map<string, string>();
    existingContacts.forEach((contact) => {
      const emailAttr = contact.attributes.find((attr) => attr.attributeKey.key === emailKey);
      if (emailAttr) {
        contactMap.set(emailAttr.value, contact.id);
      }
    });

    // 4. Split contacts into ones to update and ones to create
    const contactsToUpdate: {
      contactId: string;
      attributes: {
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
          contactId: contactMap.get(emailAttr.value)!,
          attributes: contact.attributes,
        });
      } else {
        contactsToCreate.push(contact);
      }
    }

    // 5. Execute in a transaction
    await prisma.$transaction(async (tx) => {
      // Create new contacts (one-by-one with nested writes)
      // Note: prisma.contact.createMany does not support nested writes.
      for (const contact of contactsToCreate) {
        await tx.contact.create({
          data: {
            environmentId,
            // You can set other Contact fields here if needed
            attributes: {
              create: contact.attributes.map((attr) => ({
                value: attr.value,
                // Connect to an existing attributeKey via its id
                attributeKey: { connect: { id: attributeKeyMap[attr.attributeKey.key] } },
              })),
            },
          },
        });
      }

      // For contacts that exist, upsert each attribute individually.
      // This leverages the unique constraint on (contactId, attributeKeyId).
      for (const contact of contactsToUpdate) {
        for (const attr of contact.attributes) {
          await tx.contactAttribute.upsert({
            where: {
              contactId_attributeKeyId: {
                contactId: contact.contactId,
                attributeKeyId: attributeKeyMap[attr.attributeKey.key],
              },
            },
            update: {
              value: attr.value,
            },
            create: {
              contactId: contact.contactId,
              attributeKeyId: attributeKeyMap[attr.attributeKey.key],
              value: attr.value,
            },
          });
        }
      }
    });

    return responses.successResponse({
      data: {
        message: "Contacts bulk upload successful",
        duplicateEmails: Array.from(duplicateEmails),
        duplicateUserIds: Array.from(duplicateUserIds),
        processedContacts: filteredContacts.length,
      },
    });
  } catch (error) {
    console.log(error.stack);
    return responses.internalServerErrorResponse();
  }
};
