import { logger } from "@formbricks/logger";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponse, TResponseUpdateInput } from "@formbricks/types/responses";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { responses } from "@/app/lib/api/response";
import { THandlerParams } from "@/app/lib/api/with-api-logging";
import { sendToPipeline } from "@/app/lib/pipelines";
import { getResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { formatValidationErrorsForV1Api, validateResponseData } from "@/modules/api/lib/validation";
import { validateOtherOptionLengthForMultipleChoice } from "@/modules/api/v2/lib/element";
import { createQuotaFullObject } from "@/modules/ee/quotas/lib/helpers";
import { validateFileUploads } from "@/modules/storage/utils";
import { updateResponseWithQuotaEvaluation } from "./response";
import { getValidatedResponseUpdateInput } from "./validated-response-update-input";

type TRouteResult = {
  response: Response;
  error?: unknown;
};

type TExistingResponseResult = { existingResponse: TResponse } | TRouteResult;
type TSurveyResult = { survey: TSurvey } | TRouteResult;
type TUpdatedResponseResult =
  | { updatedResponse: Awaited<ReturnType<typeof updateResponseWithQuotaEvaluation>> }
  | TRouteResult;

export type TPutRouteParams = {
  params: Promise<{
    environmentId: string;
    responseId: string;
  }>;
};

const handleDatabaseError = (
  error: Error,
  url: string,
  endpoint: string,
  responseId: string
): TRouteResult => {
  if (error instanceof ResourceNotFoundError) {
    return { response: responses.notFoundResponse("Response", responseId, true) };
  }
  if (error instanceof InvalidInputError) {
    return { response: responses.badRequestResponse(error.message, undefined, true) };
  }
  if (error instanceof DatabaseError) {
    logger.error({ error, url }, `Error in ${endpoint}`);
    return {
      response: responses.internalServerErrorResponse(error.message, true),
      error,
    };
  }

  return {
    response: responses.internalServerErrorResponse("Unknown error occurred", true),
    error,
  };
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

const getExistingResponse = async (req: Request, responseId: string): Promise<TExistingResponseResult> => {
  try {
    const existingResponse = await getResponse(responseId);

    return existingResponse
      ? { existingResponse }
      : { response: responses.notFoundResponse("Response", responseId, true) };
  } catch (error) {
    return handleDatabaseError(
      error instanceof Error ? error : new Error(String(error)),
      req.url,
      "PUT /api/v1/client/[environmentId]/responses/[responseId]",
      responseId
    );
  }
};

const getSurveyForResponse = async (
  req: Request,
  responseId: string,
  surveyId: string
): Promise<TSurveyResult> => {
  try {
    const survey = await getSurvey(surveyId);

    return survey ? { survey } : { response: responses.notFoundResponse("Survey", surveyId, true) };
  } catch (error) {
    return handleDatabaseError(
      error instanceof Error ? error : new Error(String(error)),
      req.url,
      "PUT /api/v1/client/[environmentId]/responses/[responseId]",
      responseId
    );
  }
};

const validateUpdateRequest = (
  existingResponse: TResponse,
  survey: TSurvey,
  responseUpdateInput: TResponseUpdateInput
): TRouteResult | undefined => {
  if (existingResponse.finished) {
    return {
      response: responses.badRequestResponse("Response is already finished", undefined, true),
    };
  }

  if (!validateFileUploads(responseUpdateInput.data, survey.questions)) {
    return {
      response: responses.badRequestResponse("Invalid file upload response", undefined, true),
    };
  }

  const otherResponseInvalidQuestionId = validateOtherOptionLengthForMultipleChoice({
    responseData: responseUpdateInput.data,
    surveyQuestions: survey.questions as unknown as TSurveyElement[],
    responseLanguage: responseUpdateInput.language,
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

  return validateResponse(existingResponse, survey, responseUpdateInput);
};

const getUpdatedResponse = async (
  req: Request,
  responseId: string,
  responseUpdateInput: TResponseUpdateInput
): Promise<TUpdatedResponseResult> => {
  try {
    const updatedResponse = await updateResponseWithQuotaEvaluation(responseId, responseUpdateInput);
    return { updatedResponse };
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
        error,
      };
    }

    const unexpectedError = error instanceof Error ? error : new Error(String(error));

    logger.error(
      { error: unexpectedError, url: req.url },
      "Error in PUT /api/v1/client/[environmentId]/responses/[responseId]"
    );
    return {
      response: responses.internalServerErrorResponse("Something went wrong"),
      error: unexpectedError,
    };
  }
};

export const putResponseHandler = async ({
  req,
  props,
}: THandlerParams<TPutRouteParams>): Promise<TRouteResult> => {
  const params = await props.params;
  const { environmentId, responseId } = params;

  if (!responseId) {
    return {
      response: responses.badRequestResponse("Response ID is missing", undefined, true),
    };
  }

  const validatedUpdateInput = await getValidatedResponseUpdateInput(req);
  if ("response" in validatedUpdateInput) {
    return validatedUpdateInput;
  }
  const { responseUpdateInput } = validatedUpdateInput;

  const existingResponseResult = await getExistingResponse(req, responseId);
  if ("response" in existingResponseResult) {
    return existingResponseResult;
  }
  const { existingResponse } = existingResponseResult;

  const surveyResult = await getSurveyForResponse(req, responseId, existingResponse.surveyId);
  if ("response" in surveyResult) {
    return surveyResult;
  }
  const { survey } = surveyResult;

  if (survey.environmentId !== environmentId) {
    return {
      response: responses.notFoundResponse("Response", responseId, true),
    };
  }

  const validationResult = validateUpdateRequest(existingResponse, survey, responseUpdateInput);
  if (validationResult) {
    return validationResult;
  }

  const updatedResponseResult = await getUpdatedResponse(req, responseId, responseUpdateInput);
  if ("response" in updatedResponseResult) {
    return updatedResponseResult;
  }
  const { updatedResponse } = updatedResponseResult;

  const { quotaFull, ...responseData } = updatedResponse;

  sendToPipeline({
    event: "responseUpdated",
    environmentId: survey.environmentId,
    surveyId: survey.id,
    response: responseData,
  });

  if (updatedResponse.finished) {
    sendToPipeline({
      event: "responseFinished",
      environmentId: survey.environmentId,
      surveyId: survey.id,
      response: responseData,
    });
  }

  const quotaObj = createQuotaFullObject(quotaFull);

  const responseDataWithQuota = {
    id: responseData.id,
    ...quotaObj,
  };

  return {
    response: responses.successResponse(responseDataWithQuota, true),
  };
};
