import "server-only";
import { prisma } from "@formbricks/database";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

export const getContactByUserId = async (
  environmentId: string,
  userId: string
): Promise<
  Result<
    {
      id: string;
      attributes: TContactAttributes;
    } | null,
    ApiErrorResponseV2
  >
> => {
  try {
    const contact = await prisma.contact.findFirst({
      where: {
        attributes: {
          some: {
            attributeKey: {
              key: "userId",
              environmentId,
            },
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
      },
    });

    if (!contact) {
      return ok(null);
    }

    const contactAttributes = contact.attributes.reduce((acc, attr) => {
      acc[attr.attributeKey.key] = attr.value;
      return acc;
    }, {}) as TContactAttributes;

    return ok({
      id: contact.id,
      attributes: contactAttributes,
    });
  } catch (error) {
    return err({
      type: "internal_server_error",
      details: [{ field: "contact", issue: error.message }],
    });
  }
};
