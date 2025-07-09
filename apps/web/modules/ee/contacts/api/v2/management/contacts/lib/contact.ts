import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { TContactCreateRequest, TContactResponse } from "@/modules/ee/contacts/types/contact";
import { prisma } from "@formbricks/database";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const createContact = async (
  contactData: TContactCreateRequest
): Promise<Result<TContactResponse, ApiErrorResponseV2>> => {
  const { environmentId, attributes } = contactData;

  try {
    const emailValue = attributes.email;
    if (!emailValue) {
      return err({
        type: "bad_request",
        details: [{ field: "attributes", issue: "email attribute is required" }],
      });
    }

    // Extract userId if present
    const userId = attributes.userId;

    // Check for existing contact with same email
    const existingContactByEmail = await prisma.contact.findFirst({
      where: {
        environmentId,
        attributes: {
          some: {
            attributeKey: { key: "email" },
            value: emailValue,
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

    // Get all attribute keys that need to exist
    const attributeKeys = Object.keys(attributes);

    // Check which attribute keys exist in the environment
    const existingAttributeKeys = await prisma.contactAttributeKey.findMany({
      where: {
        environmentId,
        key: { in: attributeKeys },
      },
    });

    const existingKeySet = new Set(existingAttributeKeys.map((key) => key.key));

    // Identify missing attribute keys
    const missingKeys = attributeKeys.filter((key) => !existingKeySet.has(key));

    // If any keys are missing, return an error
    if (missingKeys.length > 0) {
      return err({
        type: "bad_request",
        details: [{ field: "attributes", issue: `attribute keys not found: ${missingKeys.join(", ")}. ` }],
      });
    }

    const attributeData = Object.entries(attributes).map(([key, value]) => {
      const attributeKey = existingAttributeKeys.find((ak) => ak.key === key)!;
      return {
        attributeKeyId: attributeKey.id,
        value,
      };
    });

    const result = await prisma.contact.create({
      data: {
        environmentId,
        attributes: {
          createMany: {
            data: attributeData,
          },
        },
      },
      select: {
        id: true,
        createdAt: true,
        environmentId: true,
        attributes: {
          include: {
            attributeKey: true,
          },
        },
      },
    });

    // Format the response with flattened attributes
    const flattenedAttributes: Record<string, string> = {};
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
