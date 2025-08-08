import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { sendToPipeline } from "@/app/lib/pipelines";
import { validateFileUploads } from "@/lib/fileValidation";
import { getResponse, updateResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { validateOtherOptionLengthForMultipleChoice } from "@/modules/api/v2/lib/question";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZResponseUpdateInput } from "@formbricks/types/responses";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

const handleDatabaseError = (error: Error, url: string, endpoint: string, responseId: string): Response => {
  if (error instanceof ResourceNotFoundError) {
    return responses.notFoundResponse("Response", responseId, true);
  }
  if (error instanceof InvalidInputError) {
    return responses.badRequestResponse(error.message, undefined, true);
  }
  if (error instanceof DatabaseError) {
    logger.error({ error, url }, `Error in ${endpoint}`);
    return responses.internalServerErrorResponse(error.message, true);
  }
  return responses.internalServerErrorResponse("Unknown error occurred", true);
};

export const PUT = withV1ApiWrapper({
  handler: async ({
    req,
    props,
  }: {
    req: NextRequest;
    props: { params: Promise<{ responseId: string }> };
  }) => {
    const params = await props.params;
    const { responseId } = params;

    if (!responseId) {
      return {
        response: responses.badRequestResponse("Response ID is missing", undefined, true),
      };
    }

    const responseUpdate = await req.json();
    const inputValidation = ZResponseUpdateInput.safeParse(responseUpdate);

    if (!inputValidation.success) {
      return {
        response: responses.badRequestResponse(
          "Fields are missing or incorrectly formatted",
          transformErrorToDetails(inputValidation.error),
          true
        ),
      };
    }

    let response;
    try {
      response = await getResponse(responseId);
    } catch (error) {
      const endpoint = "PUT /api/v1/client/[environmentId]/responses/[responseId]";
      return {
        response: handleDatabaseError(error, req.url, endpoint, responseId),
      };
    }

    if (response.finished) {
      return {
        response: responses.badRequestResponse("Response is already finished", undefined, true),
      };
    }

    // get survey to get environmentId
    let survey;
    try {
      survey = await getSurvey(response.surveyId);
    } catch (error) {
      const endpoint = "PUT /api/v1/client/[environmentId]/responses/[responseId]";
      return {
        response: handleDatabaseError(error, req.url, endpoint, responseId),
      };
    }

    if (!validateFileUploads(inputValidation.data.data, survey.questions)) {
      return {
        response: responses.badRequestResponse("Invalid file upload response", undefined, true),
      };
    }

    // Validate response data for "other" options exceeding character limit
    const otherResponseInvalidQuestionId = validateOtherOptionLengthForMultipleChoice({
      responseData: inputValidation.data.data,
      surveyQuestions: survey.questions,
      responseLanguage: inputValidation.data.language,
    });

    if (otherResponseInvalidQuestionId) {
      return {
        response: responses.badRequestResponse(
          `Response exceeds character limit`,
          {
            questionId: otherResponseInvalidQuestionId,
          },
          true
        ),
      };
    }

    // update response
    let updatedResponse;
    try {
      updatedResponse = await updateResponse(responseId, inputValidation.data);
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        return {
          response: responses.notFoundResponse("Response", responseId, true),
        };
      }
      if (error instanceof InvalidInputError) {
        return {
          response: responses.badRequestResponse(error.message),
        };
      }
      if (error instanceof DatabaseError) {
        logger.error(
          { error, url: req.url },
          "Error in PUT /api/v1/client/[environmentId]/responses/[responseId]"
        );
        return {
          response: responses.internalServerErrorResponse(error.message),
        };
      }
    }

    // send response update to pipeline
    // don't await to not block the response
    sendToPipeline({
      event: "responseUpdated",
      environmentId: survey.environmentId,
      surveyId: survey.id,
      response: updatedResponse,
    });

    if (updatedResponse.finished) {
      // send response to pipeline
      // don't await to not block the response
      sendToPipeline({
        event: "responseFinished",
        environmentId: survey.environmentId,
        surveyId: survey.id,
        response: updatedResponse,
      });
    }
    return {
      response: responses.successResponse({}, true),
    };
  },
});
