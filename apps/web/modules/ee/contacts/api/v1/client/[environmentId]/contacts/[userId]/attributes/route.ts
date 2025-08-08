import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { updateAttributes } from "@/modules/ee/contacts/lib/attributes";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZJsContactsUpdateAttributeInput } from "@formbricks/types/js";
import { getContactByUserIdWithAttributes } from "./lib/contact";

const validateParams = (
  environmentId: string,
  userId: string
): { isValid: true } | { isValid: false; error: Response } => {
  if (!environmentId) {
    return {
      isValid: false,
      error: responses.badRequestResponse("environmentId is required", { environmentId }, true),
    };
  }
  if (!userId) {
    return { isValid: false, error: responses.badRequestResponse("userId is required", { userId }, true) };
  }
  return { isValid: true };
};

const checkIfAttributesNeedUpdate = (contact: any, updatedAttributes: Record<string, string>) => {
  const oldAttributes = new Map(contact.attributes.map((attr: any) => [attr.attributeKey.key, attr.value]));

  for (const [key, value] of Object.entries(updatedAttributes)) {
    if (value !== oldAttributes.get(key)) {
      return false; // needs update
    }
  }
  return true; // up to date
};

export const OPTIONS = async () => {
  // cors headers
  return responses.successResponse({}, true);
};

export const PUT = withV1ApiWrapper({
  handler: async ({
    req,
    props,
  }: {
    req: NextRequest;
    props: { params: Promise<{ environmentId: string; userId: string }> };
  }) => {
    try {
      const params = await props.params;
      const { environmentId, userId } = params;

      // Validate required parameters
      const paramValidation = validateParams(environmentId, userId);
      if (!paramValidation.isValid) {
        return { response: paramValidation.error };
      }

      // Parse and validate input
      const jsonInput = await req.json();
      const parsedInput = ZJsContactsUpdateAttributeInput.safeParse(jsonInput);
      if (!parsedInput.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(parsedInput.error),
            true
          ),
        };
      }

      // Check enterprise license
      const isContactsEnabled = await getIsContactsEnabled();
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(
            "User identification is only available for enterprise users.",
            true
          ),
        };
      }

      // Process attributes (ignore userId and id)
      const { userId: userIdAttr, id: idAttr, ...updatedAttributes } = parsedInput.data.attributes;

      const contact = await getContactByUserIdWithAttributes(environmentId, userId, updatedAttributes);
      if (!contact) {
        return { response: responses.notFoundResponse("contact", userId, true) };
      }

      // Check if update is needed
      const isUpToDate = checkIfAttributesNeedUpdate(contact, updatedAttributes);
      if (isUpToDate) {
        return {
          response: responses.successResponse(
            { changed: false, message: "No updates were necessary; the person is already up to date." },
            true
          ),
        };
      }

      // Perform update
      const { messages } = await updateAttributes(contact.id, userId, environmentId, updatedAttributes);

      return {
        response: responses.successResponse(
          {
            changed: true,
            message: "The person was successfully updated.",
            ...(messages && messages.length > 0 ? { messages } : {}),
          },
          true
        ),
      };
    } catch (err) {
      logger.error({ err, url: req.url }, "Error updating attributes");
      if (err.statusCode === 403) {
        return {
          response: responses.forbiddenResponse(err.message || "Forbidden", true, { ignore: true }),
        };
      }

      if (err instanceof ResourceNotFoundError) {
        return {
          response: responses.notFoundResponse(err.resourceType, err.resourceId, true),
        };
      }

      return {
        response: responses.internalServerErrorResponse("Something went wrong", true),
      };
    }
  },
});
