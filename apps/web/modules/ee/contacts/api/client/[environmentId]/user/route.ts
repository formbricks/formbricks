import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { NextRequest, userAgent } from "next/server";
import { logger } from "@formbricks/logger";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TJsPersonState, ZJsUserIdentifyInput, ZJsUserUpdateInput } from "@formbricks/types/js";
import { updateUser } from "./lib/update-user";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const POST = async (
  request: NextRequest,
  props: { params: Promise<{ environmentId: string }> }
): Promise<Response> => {
  const params = await props.params;

  try {
    const { environmentId } = params;
    const jsonInput = await request.json();

    // Validate input
    const syncInputValidation = ZJsUserIdentifyInput.pick({ environmentId: true }).safeParse({
      environmentId,
    });

    if (!syncInputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(syncInputValidation.error),
        true
      );
    }

    const parsedInput = ZJsUserUpdateInput.safeParse(jsonInput);
    if (!parsedInput.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(parsedInput.error),
        true
      );
    }

    const { userId, attributes } = parsedInput.data;

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("User identification is only available for enterprise users.", true);
    }

    let attributeUpdatesToSend: TContactAttributes | null = null;
    if (attributes) {
      // remove userId and id from attributes
      const { userId: userIdAttr, id: idAttr, ...updatedAttributes } = attributes;
      attributeUpdatesToSend = updatedAttributes;
    }

    const { device } = userAgent(request);
    const deviceType = device ? "phone" : "desktop";

    try {
      const { state: userState, messages } = await updateUser(
        environmentId,
        userId,
        deviceType,
        attributeUpdatesToSend ?? undefined
      );

      let responseJson: { state: TJsPersonState; messages?: string[] } = {
        state: userState,
      };

      if (messages && messages.length > 0) {
        responseJson.messages = messages;
      }

      return responses.successResponse(responseJson, true);
    } catch (err) {
      if (err instanceof ResourceNotFoundError) {
        return responses.notFoundResponse(err.resourceType, err.resourceId);
      }

      logger.warn({ err, url: request.url }, "Error in POST /api/v1/client/[environmentId]/user");
      return responses.internalServerErrorResponse(err.message ?? "Unable to fetch person state", true);
    }
  } catch (error) {
    logger.warn({ error, url: request.url }, "Error in POST /api/v1/client/[environmentId]/user");
    return responses.internalServerErrorResponse(`Unable to complete response: ${error.message}`, true);
  }
};
