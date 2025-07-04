import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { TContactCreateRequest, TContactResponse } from "@/modules/ee/contacts/types/contact";
import { prisma } from "@formbricks/database";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const createContact = async (
  contactData: TContactCreateRequest
): Promise<Result<TContactResponse, ApiErrorResponseV2>> => {
  const { environmentId, attributes } = contactData;

  try {
    const emailAttr = attributes.find((attr) => attr.attributeKey.key === "email");
    if (!emailAttr?.value) {
      return err({
        type: "bad_request",
        details: [{ field: "attributes", issue: "email attribute is required" }],
      });
    }

    // Extract userId if present
    const userIdAttr = attributes.find((attr) => attr.attributeKey.key === "userId");
    const userId = userIdAttr?.value;

    // Check for existing contact with same email
    const existingContactByEmail = await prisma.contact.findFirst({
      where: {
        environmentId,
        attributes: {
          some: {
            attributeKey: { key: "email" },
            value: emailAttr.value,
          },
        },
      },
    });

    if (existingContactByEmail) {
      return err({
        type: "conflict",
        details: [{ field: "email", issue: "contact with this email already exists" }],
      });
    }

    // Check for existing contact with same userId (if provided)
    if (userId) {
      const existingContactByUserId = await prisma.contact.findFirst({
        where: {
          environmentId,
          attributes: {
            some: {
              attributeKey: { key: "userId" },
              value: userId,
            },
          },
        },
      });

      if (existingContactByUserId) {
        return err({
          type: "conflict",
          details: [{ field: "userId", issue: "contact with this userId already exists" }],
        });
      }
    }

    // Get all attribute keys that need to be created
    const attributeKeys = attributes.map((attr) => attr.attributeKey.key);

    // Check which attribute keys exist in the environment
    const existingAttributeKeys = await prisma.contactAttributeKey.findMany({
      where: {
        environmentId,
        key: { in: attributeKeys },
      },
    });

    const existingKeySet = new Set(existingAttributeKeys.map((key) => key.key));

    // Identify missing attribute keys
    const attributeKeysToCreate = attributes
      .filter((attr) => !existingKeySet.has(attr.attributeKey.key))
      .map((attr) => ({
        key: attr.attributeKey.key,
        name: attr.attributeKey.name,
        type: "custom" as const,
        environmentId,
      }));

    // Create the contact and attributes in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create missing attribute keys within the transaction
      if (attributeKeysToCreate.length > 0) {
        const newlyCreatedKeys = await tx.contactAttributeKey.createManyAndReturn({
          data: attributeKeysToCreate,
        });

        // Add newly created keys to the existing array
        existingAttributeKeys.push(...newlyCreatedKeys);
      }

      // Create the contact
      const newContact = await tx.contact.create({
        data: {
          environmentId,
        },
      });

      // Create all attributes for the contact
      const attributeData = attributes.map((attr) => {
        const attributeKey = existingAttributeKeys.find((key) => key.key === attr.attributeKey.key);
        if (!attributeKey) {
          throw new Error(`Attribute key ${attr.attributeKey.key} not found`);
        }
        return {
          contactId: newContact.id,
          attributeKeyId: attributeKey.id,
          value: attr.value,
        };
      });

      await tx.contactAttribute.createMany({
        data: attributeData,
      });

      // Fetch the created contact with attributes
      const contactWithAttributes = await tx.contact.findUnique({
        where: { id: newContact.id },
        include: {
          attributes: {
            include: {
              attributeKey: true,
            },
          },
        },
      });

      return contactWithAttributes;
    });

    if (!result) {
      return err({
        type: "internal_server_error",
        details: [{ field: "contact", issue: "failed to create contact" }],
      });
    }

    // Format the response with flattened attributes
    const flattenedAttributes: Record<string, string | null> = {};
    result.attributes.forEach((attr) => {
      flattenedAttributes[attr.attributeKey.key] = attr.value;
    });

    const response: TContactResponse = {
      id: result.id,
      createdAt: result.createdAt,
      environmentId: result.environmentId,
      attributes: flattenedAttributes,
    };

    return ok(response);
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "contact", issue: error.message }],
    });
  }
};
