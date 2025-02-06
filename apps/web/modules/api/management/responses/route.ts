import { authenticateRequest } from "@/app/api/v1/auth";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { responses } from "@/modules/api/lib/utils/response";
import { authenticatedAPIClient } from "@/modules/api/management/auth";
import { TResponseNew, ZGetResponsesFilter } from "@/modules/api/management/responses/types/responses";
import { NextRequest } from "next/server";
import { getSurvey } from "@formbricks/lib/survey/service";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { ZResponseInput } from "@formbricks/types/responses";
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

export const POST = async (request: Request): Promise<Response> => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const environmentId = authentication.environmentId;

    let jsonInput;

    try {
      jsonInput = await request.json();
    } catch (err) {
      console.error(`Error parsing JSON input: ${err}`);
      return responses.badRequestResponse("Malformed JSON input, please check your request body");
    }

    // add environmentId to response
    jsonInput.environmentId = environmentId;

    const inputValidation = ZResponseInput.safeParse(jsonInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const responseInput = inputValidation.data;

    // get and check survey
    const survey = await getSurvey(responseInput.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", responseInput.surveyId, true);
    }
    if (survey.environmentId !== environmentId) {
      return responses.badRequestResponse(
        "Survey is part of another environment",
        {
          "survey.environmentId": survey.environmentId,
          environmentId,
        },
        true
      );
    }

    // if there is a createdAt but no updatedAt, set updatedAt to createdAt
    if (responseInput.createdAt && !responseInput.updatedAt) {
      responseInput.updatedAt = responseInput.createdAt;
    }

    let response: TResponseNew;
    try {
      response = await createResponse(inputValidation.data);
    } catch (error) {
      if (error instanceof InvalidInputError) {
        return responses.badRequestResponse(error.message);
      } else {
        console.error(error);
        return responses.internalServerErrorResponse(error.message);
      }
    }

    return responses.successResponse(response, true);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};
