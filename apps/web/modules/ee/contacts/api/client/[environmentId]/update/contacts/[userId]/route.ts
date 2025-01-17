import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { contactCache } from "@/lib/cache/contact";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { NextRequest, userAgent } from "next/server";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZJsContactsUpdateAttributeInput, ZJsPersonIdentifyInput } from "@formbricks/types/js";
import { getPersonState } from "./lib/personState";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const POST = async (
  request: NextRequest,
  props: { params: Promise<{ environmentId: string; userId: string }> }
): Promise<Response> => {
  const params = await props.params;

  try {
    const { environmentId, userId } = params;
    const jsonInput = await request.json();

    // Validate input
    const syncInputValidation = ZJsPersonIdentifyInput.safeParse({
      environmentId,
      userId,
    });
    if (!syncInputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(syncInputValidation.error),
        true
      );
    }

    const parsedInput = ZJsContactsUpdateAttributeInput.optional().safeParse(jsonInput);
    if (!parsedInput.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(parsedInput.error),
        true
      );
    }

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("User identification is only available for enterprise users.", true);
    }

    let attributesUpdatesToSend: TContactAttributes | null = null;
    if (parsedInput.data?.attributes) {
      const { attributes } = parsedInput.data;
      const { userId: userIdAttr, id: idAttr, ...updatedAttributes } = attributes;
      attributesUpdatesToSend = updatedAttributes;
    }

    const { device } = userAgent(request);
    const deviceType = device ? "phone" : "desktop";

    try {
      const personState = await getPersonState({
        environmentId,
        userId,
        device: deviceType,
        attributes: attributesUpdatesToSend ?? undefined,
      });

      if (personState.updateAttrResponse)
        if (personState.revalidateProps?.revalidate) {
          contactCache.revalidate({
            environmentId,
            userId,
            id: personState.revalidateProps.contactId,
          });
        }

      return responses.successResponse(personState.state, true);
    } catch (err) {
      if (err instanceof ResourceNotFoundError) {
        return responses.notFoundResponse(err.resourceType, err.resourceId);
      }

      console.error(err);
      return responses.internalServerErrorResponse(err.message ?? "Unable to fetch person state", true);
    }
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(`Unable to complete response: ${error.message}`, true);
  }
};
