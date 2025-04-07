import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { contactCache } from "@/lib/cache/contact";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { NextRequest, userAgent } from "next/server";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZJsUserIdentifyInput } from "@formbricks/types/js";
import { getPersonState } from "./lib/personState";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const GET = async (
  request: NextRequest,
  props: { params: Promise<{ environmentId: string; userId: string }> }
): Promise<Response> => {
  const params = await props.params;

  try {
    const { environmentId, userId } = params;

    // Validate input
    const syncInputValidation = ZJsUserIdentifyInput.safeParse({
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

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("User identification is only available for enterprise users.", true);
    }

    const { device } = userAgent(request);
    const deviceType = device ? "phone" : "desktop";

    try {
      const personState = await getPersonState({
        environmentId,
        userId,
        device: deviceType,
      });

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

      logger.error({ err, url: request.url }, "Error fetching person state");
      return responses.internalServerErrorResponse(err.message ?? "Unable to fetch person state", true);
    }
  } catch (error) {
    logger.error({ error, url: request.url }, "Error fetching person state");
    return responses.internalServerErrorResponse(`Unable to complete response: ${error.message}`, true);
  }
};
