import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { updateResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { ZResponseUpdateInput } from "@formbricks/types/responses";
import { queuePipelineJob } from "@formbricks/worker";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const PUT = async (
  request: Request,
  props: { params: Promise<{ responseId: string }> }
): Promise<Response> => {
  const params = await props.params;
  const { responseId } = params;

  if (!responseId) {
    return responses.badRequestResponse("Response ID is missing", undefined, true);
  }

  const responseUpdate = await request.json();

  const inputValidation = ZResponseUpdateInput.safeParse(responseUpdate);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  // update response
  let response;
  try {
    response = await updateResponse(responseId, inputValidation.data);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return responses.notFoundResponse("Response", responseId, true);
    }
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    }
    if (error instanceof DatabaseError) {
      logger.error(
        { error, url: request.url },
        "Error in PUT /api/v1/client/[environmentId]/responses/[responseId]"
      );
      return responses.internalServerErrorResponse(error.message);
    }
  }

  // get survey to get environmentId
  let survey;
  try {
    survey = await getSurvey(response.surveyId);
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    }
    if (error instanceof DatabaseError) {
      logger.error(
        { error, url: request.url },
        "Error in PUT /api/v1/client/[environmentId]/responses/[responseId]"
      );
      return responses.internalServerErrorResponse(error.message);
    }
  }

  // send response update to pipeline
  queuePipelineJob("responseCreated", {
    environmentId: survey.environmentId,
    surveyId: response.surveyId,
    response: response,
  });

  if (response.finished) {
    // send response to pipeline
    queuePipelineJob("responseFinished", {
      environmentId: survey.environmentId,
      surveyId: response.surveyId,
      response: response,
    });
  }
  return responses.successResponse({}, true);
};
