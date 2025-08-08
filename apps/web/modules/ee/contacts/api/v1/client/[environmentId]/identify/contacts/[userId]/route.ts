import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { NextRequest, userAgent } from "next/server";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZJsUserIdentifyInput } from "@formbricks/types/js";
import { getPersonState } from "./lib/person-state";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const GET = withV1ApiWrapper({
  handler: async ({
    req,
    props,
  }: {
    req: NextRequest;
    props: { params: Promise<{ environmentId: string; userId: string }> };
  }) => {
    const params = await props.params;

    try {
      const { environmentId, userId } = params;

      // Validate input
      const syncInputValidation = ZJsUserIdentifyInput.safeParse({
        environmentId,
        userId,
      });
      if (!syncInputValidation.success) {
        return {
          response: responses.badRequestResponse(
            "Fields are missing or incorrectly formatted",
            transformErrorToDetails(syncInputValidation.error),
            true
          ),
        };
      }

      const isContactsEnabled = await getIsContactsEnabled();
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(
            "User identification is only available for enterprise users.",
            true
          ),
        };
      }

      const { device } = userAgent(req);
      const deviceType = device ? "phone" : "desktop";

      try {
        const personState = await getPersonState({
          environmentId,
          userId,
          device: deviceType,
        });

        return {
          response: responses.successResponse(personState.state, true),
        };
      } catch (err) {
        if (err instanceof ResourceNotFoundError) {
          return {
            response: responses.notFoundResponse(err.resourceType, err.resourceId),
          };
        }

        logger.error({ err, url: req.url }, "Error fetching person state");
        return {
          response: responses.internalServerErrorResponse(
            err.message ?? "Unable to fetch person state",
            true
          ),
        };
      }
    } catch (error) {
      logger.error({ error, url: req.url }, "Error fetching person state");
      return {
        response: responses.internalServerErrorResponse(
          `Unable to complete response: ${error.message}`,
          true
        ),
      };
    }
  },
});
