import { responses } from "@/modules/api/lib/response";
import { authenticatedApiClient, checkAuthorization } from "@/modules/api/management/auth";
import { getEnvironmentIdFromSurveyId } from "@/modules/api/management/lib/helper";
import { ZGetResponsesFilter, ZResponseInput } from "@/modules/api/management/responses/types/responses";
import { Response } from "@prisma/client";
import { NextRequest } from "next/server";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { InvalidInputError } from "@formbricks/types/errors";
import { createResponse, getResponses } from "./lib/response";

export const GET = async (request: NextRequest) =>
  authenticatedApiClient({
    request,
    handler: async ({ authentication }) => {
      const params = Object.fromEntries(request.nextUrl.searchParams.entries());
      const [validatedParams] = validateInputs([params, ZGetResponsesFilter]);

      const environmentId = authentication.environmentId;

      const res = await getResponses(environmentId, validatedParams);

      return responses.successResponse({ data: res });
    },
  });

export const POST = async (request: Request) =>
  authenticatedApiClient({
    request,
    schema: ZResponseInput,
    handler: async ({ authentication, parsedInput }) => {
      if (!parsedInput) {
        return responses.badRequestResponse({ message: "Invalid request body" });
      }

      const environmentId = await getEnvironmentIdFromSurveyId(parsedInput.surveyId);

      await checkAuthorization({
        authentication,
        environmentId,
      });

      // if there is a createdAt but no updatedAt, set updatedAt to createdAt
      if (parsedInput.createdAt && !parsedInput.updatedAt) {
        parsedInput.updatedAt = parsedInput.createdAt;
      }

      let response: Response;
      try {
        response = await createResponse(environmentId, parsedInput);
      } catch (error) {
        if (error instanceof InvalidInputError) {
          return responses.badRequestResponse({ message: error.message });
        } else {
          console.error(error);
          return responses.internalServerErrorResponse(error.message);
        }
      }

      return responses.successResponse({ data: response, cors: true });
    },
  });
