import { responses } from "@/modules/api/lib/utils/response";
import { authenticatedAPIClient, checkAuthorization } from "@/modules/api/management/auth";
import { getEnvironmentIdFromSurveyId } from "@/modules/api/management/lib/helper";
import {
  TResponseNew,
  ZGetResponsesFilter,
  ZResponseInput,
} from "@/modules/api/management/responses/types/responses";
import { NextRequest } from "next/server";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { InvalidInputError } from "@formbricks/types/errors";
import { createResponse, getResponses } from "./lib/response";

export const GET = async (request: NextRequest) =>
  authenticatedAPIClient({
    request,
    handler: async ({ authentication }) => {
      const searchParams = request.nextUrl.searchParams;
      const params = Object.fromEntries(searchParams.entries());
      const [validatedParams] = validateInputs([params, ZGetResponsesFilter]);

      const environmentId = authentication.environmentId;

      const res = await getResponses(environmentId, validatedParams);

      return responses.successResponse(res);
    },
  });

export const POST = async (request: Request) =>
  authenticatedAPIClient({
    request,
    schema: ZResponseInput,
    handler: async ({ authentication, parsedInput }) => {
      if (!parsedInput) {
        return responses.badRequestResponse("Invalid request body", {});
      }

      await checkAuthorization({
        authentication,
        environmentId: await getEnvironmentIdFromSurveyId(parsedInput.surveyId),
      });

      // if there is a createdAt but no updatedAt, set updatedAt to createdAt
      if (parsedInput.createdAt && !parsedInput.updatedAt) {
        parsedInput.updatedAt = parsedInput.createdAt;
      }

      let response: TResponseNew;
      try {
        response = await createResponse(parsedInput);
      } catch (error) {
        if (error instanceof InvalidInputError) {
          return responses.badRequestResponse(error.message);
        } else {
          console.error(error);
          return responses.internalServerErrorResponse(error.message);
        }
      }

      return responses.successResponse(response, true);
    },
  });
