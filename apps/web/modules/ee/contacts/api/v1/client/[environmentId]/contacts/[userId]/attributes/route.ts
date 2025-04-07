import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { updateAttributes } from "@/modules/ee/contacts/lib/attributes";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZJsContactsUpdateAttributeInput } from "@formbricks/types/js";
import { getContactByUserIdWithAttributes } from "./lib/contact";

export const OPTIONS = async () => {
  // cors headers
  return responses.successResponse({}, true);
};

export const PUT = async (
  req: NextRequest,
  context: { params: Promise<{ environmentId: string; userId: string }> }
) => {
  try {
    const params = await context.params;
    const environmentId = params.environmentId;
    if (!environmentId) {
      return responses.badRequestResponse("environmentId is required", { environmentId }, true);
    }

    const userId = params.userId;
    if (!userId) {
      return responses.badRequestResponse("userId is required", { userId }, true);
    }

    const jsonInput = await req.json();

    const parsedInput = ZJsContactsUpdateAttributeInput.safeParse(jsonInput);
    if (!parsedInput.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(parsedInput.error),
        true
      );
    }

    // check for ee license:
    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("User identification is only available for enterprise users.", true);
    }

    // ignore userId and id
    const { userId: userIdAttr, id: idAttr, ...updatedAttributes } = parsedInput.data.attributes;

    const contact = await getContactByUserIdWithAttributes(environmentId, userId, updatedAttributes);

    if (!contact) {
      return responses.notFoundResponse("contact", userId, true);
    }

    const oldAttributes = new Map(contact.attributes.map((attr) => [attr.attributeKey.key, attr.value]));

    let isUpToDate = true;
    for (const [key, value] of Object.entries(updatedAttributes)) {
      if (value !== oldAttributes.get(key)) {
        isUpToDate = false;
        break;
      }
    }

    if (isUpToDate) {
      return responses.successResponse(
        {
          changed: false,
          message: "No updates were necessary; the person is already up to date.",
        },
        true
      );
    }

    const { messages } = await updateAttributes(contact.id, userId, environmentId, updatedAttributes);

    return responses.successResponse(
      {
        changed: true,
        message: "The person was successfully updated.",
        ...(messages && messages.length > 0
          ? {
              messages,
            }
          : {}),
      },
      true
    );
  } catch (err) {
    logger.error({ err, url: req.url }, "Error updating attributes");
    if (err.statusCode === 403) {
      return responses.forbiddenResponse(err.message || "Forbidden", true, { ignore: true });
    }

    if (err instanceof ResourceNotFoundError) {
      return responses.notFoundResponse(err.resourceType, err.resourceId, true);
    }

    return responses.internalServerErrorResponse("Something went wrong", true);
  }
};
