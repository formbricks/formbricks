import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import type { TResponseWithQuotaFull } from "@formbricks/types/quota";
import { type TResponse, type TResponseUpdateInput, ZResponseUpdateInput } from "@formbricks/types/responses";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import type { THandlerParams } from "@/app/lib/api/with-api-logging";
import { enqueueResponsePipelineEvents } from "@/app/lib/pipelines";
import { getResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { formatValidationErrorsForV1Api, validateResponseData } from "@/modules/api/lib/validation";
import { validateOtherOptionLengthForMultipleChoice } from "@/modules/api/v2/lib/element";
import { createQuotaFullObject } from "@/modules/ee/quotas/lib/helpers";
import { validateFileUploads } from "@/modules/storage/utils";
import { updateResponseWithQuotaEvaluation } from "./response";

const UPDATE_RESPONSE_ENDPOINT = "PUT /api/v1/client/[environmentId]/responses/[responseId]";

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

const getValidatedResponseUpdateInput = async (req: Request): Promise<Response | TResponseUpdateInput> => {
  let responseUpdate;

  try {
    responseUpdate = await req.json();
  } catch (error) {
    return responses.badRequestResponse(
      "Invalid JSON in request body",
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      true
    );
  }

  const inputValidation = ZResponseUpdateInput.safeParse(responseUpdate);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  return inputValidation.data;
};

const getResponseForUpdate = async (req: Request, responseId: string): Promise<Response | TResponse> => {
  try {
    const response = await getResponse(responseId);

    if (!response) {
      return responses.notFoundResponse("Response", responseId, true);
    }

    if (response.finished) {
      return responses.badRequestResponse("Response is already finished", undefined, true);
    }

    return response;
  } catch (error) {
    return handleDatabaseError(
      error instanceof Error ? error : new Error(String(error)),
      req.url,
      UPDATE_RESPONSE_ENDPOINT,
      responseId
    );
  }
};

const getSurveyForResponseUpdate = async (
  req: Request,
  environmentId: string,
  responseId: string,
  surveyId: string
): Promise<Response | TSurvey> => {
  try {
    const survey = await getSurvey(surveyId);

    if (!survey) {
      return responses.notFoundResponse("Survey", surveyId, true);
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

    return survey;
  } catch (error) {
    return handleDatabaseError(
      error instanceof Error ? error : new Error(String(error)),
      req.url,
      UPDATE_RESPONSE_ENDPOINT,
      responseId
    );
  }
};

const validateResponse = (
  response: TResponse,
  survey: TSurvey,
  responseUpdateInput: TResponseUpdateInput
) => {
  const mergedData = {
    ...response.data,
    ...responseUpdateInput.data,
  };

  const validationErrors = validateResponseData(
    survey.blocks,
    mergedData,
    responseUpdateInput.language ?? response.language ?? "en",
    survey.questions
  );

  if (validationErrors) {
    return {
      response: responses.badRequestResponse(
        "Validation failed",
        formatValidationErrorsForV1Api(validationErrors),
        true
      ),
    };
  }
};

const getResponseUpdateValidationError = (
  response: TResponse,
  survey: TSurvey,
  responseUpdateInput: TResponseUpdateInput
): Response | undefined => {
  if (!validateFileUploads(responseUpdateInput.data, survey.questions)) {
    return responses.badRequestResponse("Invalid file upload response", undefined, true);
  }

  const otherResponseInvalidQuestionId = validateOtherOptionLengthForMultipleChoice({
    responseData: responseUpdateInput.data,
    surveyQuestions: survey.questions as unknown as TSurveyElement[],
    responseLanguage: responseUpdateInput.language,
  });

  if (otherResponseInvalidQuestionId) {
    return responses.badRequestResponse(
      "Response exceeds character limit",
      {
        questionId: otherResponseInvalidQuestionId,
      },
      true
    );
  }

  return validateResponse(response, survey, responseUpdateInput)?.response;
};

const updateResponseSafely = async (
  req: Request,
  responseId: string,
  responseUpdateInput: TResponseUpdateInput
): Promise<Response | TResponseWithQuotaFull> => {
  try {
    return await updateResponseWithQuotaEvaluation(responseId, responseUpdateInput);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return responses.notFoundResponse("Response", responseId, true);
    }

    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message, undefined, true);
    }

    if (error instanceof DatabaseError) {
      logger.error({ error, url: req.url }, `Error in ${UPDATE_RESPONSE_ENDPOINT}`);
      return responses.internalServerErrorResponse(error.message, true);
    }

    logger.error({ error, url: req.url }, `Error in ${UPDATE_RESPONSE_ENDPOINT}`);
    return responses.internalServerErrorResponse("Something went wrong", true);
  }
};

export const handleUpdateResponseRequest = async ({
  req,
  props,
}: THandlerParams<{ params: Promise<{ environmentId: string; responseId: string }> }>): Promise<{
  response: Response;
}> => {
  const params = await props.params;
  const { environmentId, responseId } = params;

  if (!responseId) {
    return {
      response: responses.badRequestResponse("Response ID is missing", undefined, true),
    };
  }

  const responseUpdateInput = await getValidatedResponseUpdateInput(req);
  if (responseUpdateInput instanceof Response) {
    return {
      response: responseUpdateInput,
    };
  }

  const response = await getResponseForUpdate(req, responseId);
  if (response instanceof Response) {
    return {
      response,
    };
  }

  const survey = await getSurveyForResponseUpdate(req, environmentId, responseId, response.surveyId);
  if (survey instanceof Response) {
    return {
      response: survey,
    };
  }

  const validationError = getResponseUpdateValidationError(response, survey, responseUpdateInput);
  if (validationError) {
    return {
      response: validationError,
    };
  }

  const updatedResponse = await updateResponseSafely(req, responseId, responseUpdateInput);
  if (updatedResponse instanceof Response) {
    return {
      response: updatedResponse,
    };
  }

  const { quotaFull, ...responseData } = updatedResponse;

  await enqueueResponsePipelineEvents({
    environmentId: survey.environmentId,
    events: updatedResponse.finished ? ["responseUpdated", "responseFinished"] : ["responseUpdated"],
    response: responseData,
    responseId: responseData.id,
    surveyId: survey.id,
  });

  const quotaObj = createQuotaFullObject(quotaFull);
  const responseDataWithQuota = {
    id: responseData.id,
    ...quotaObj,
  };

  return {
    response: responses.successResponse(responseDataWithQuota, true),
  };
};
