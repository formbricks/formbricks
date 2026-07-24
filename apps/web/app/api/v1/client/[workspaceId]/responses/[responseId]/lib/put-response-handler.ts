import { RESPONSE_ALREADY_FINISHED_ERROR_CODE, ResourceNotFoundError } from "@formbricks/types/errors";
import { TResponse, TResponseUpdateInput } from "@formbricks/types/responses";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { type ApiErrorResult, handleApiError } from "@/app/lib/api/handle-api-error";
import { responses } from "@/app/lib/api/response";
import { THandlerParams } from "@/app/lib/api/with-api-logging";
import { sendToPipeline } from "@/app/lib/pipelines";
import { getResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";
import { formatValidationErrorsForV1Api, validateResponseData } from "@/modules/api/lib/validation";
import { validateOtherOptionLengthForMultipleChoice } from "@/modules/api/v2/lib/element";
import { createQuotaFullObject } from "@/modules/ee/quotas/lib/helpers";
import { validateClientFileUploads } from "@/modules/storage/utils";
import { verifyLinkSurveyPinToken } from "@/modules/survey/link/lib/pin-token";
import { updateResponseWithQuotaEvaluation } from "./response";
import { getValidatedResponseUpdateInput } from "./validated-response-update-input";

type TRouteResult = ApiErrorResult;

type TExistingResponseResult = { existingResponse: TResponse } | TRouteResult;
type TSurveyResult = { survey: TSurvey } | TRouteResult;
type TUpdatedResponseResult =
  | { updatedResponse: Awaited<ReturnType<typeof updateResponseWithQuotaEvaluation>> }
  | TRouteResult;

export type TPutRouteParams = {
  params: Promise<{
    workspaceId: string;
    responseId: string;
  }>;
};

const handleDatabaseError = (error: unknown, responseId: string): TRouteResult => {
  // A missing resource keeps its route-specific "Response" framing; everything else (DatabaseError,
  // unexpected) is generic-ized here and reported server-side by the wrapper via handleApiError.
  if (error instanceof ResourceNotFoundError) {
    return { response: responses.notFoundResponse("Response", responseId, true) };
  }
  return handleApiError(error, { cors: true });
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

const getExistingResponse = async (responseId: string): Promise<TExistingResponseResult> => {
  try {
    const existingResponse = await getResponse(responseId);

    return existingResponse
      ? { existingResponse }
      : { response: responses.notFoundResponse("Response", responseId, true) };
  } catch (error) {
    return handleDatabaseError(error, responseId);
  }
};

const getSurveyForResponse = async (responseId: string, surveyId: string): Promise<TSurveyResult> => {
  try {
    const survey = await getSurvey(surveyId);

    return survey ? { survey } : { response: responses.notFoundResponse("Survey", surveyId, true) };
  } catch (error) {
    return handleDatabaseError(error, responseId);
  }
};

const validateUpdateRequest = (
  existingResponse: TResponse,
  survey: TSurvey,
  responseUpdateInput: TResponseUpdateInput,
  workspaceId: string
): TRouteResult | undefined => {
  // Mirror the POST endpoint: a closed survey accepts no submissions, including finalizing a partial
  // response created while it was open (ENG-1654).
  if (survey.status !== "inProgress") {
    return {
      response: responses.forbiddenResponse("Survey is not accepting submissions", true, {
        surveyId: survey.id,
      }),
    };
  }

  if (existingResponse.finished) {
    return {
      response: responses.badRequestResponse(
        "Response is already finished",
        { code: RESPONSE_ALREADY_FINISHED_ERROR_CODE },
        true
      ),
    };
  }

  if (
    !validateClientFileUploads({
      data: responseUpdateInput.data,
      workspaceId,
      surveyId: survey.id,
      blocks: survey.blocks,
      questions: survey.questions,
    })
  ) {
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
  responseId: string,
  responseUpdateInput: TResponseUpdateInput
): Promise<TUpdatedResponseResult> => {
  try {
    const updatedResponse = await updateResponseWithQuotaEvaluation(responseId, responseUpdateInput);
    return { updatedResponse };
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return { response: responses.notFoundResponse("Response", responseId, true) };
    }
    return handleApiError(error, { cors: true });
  }
};

export const putResponseHandler = async ({
  req,
  props,
}: THandlerParams<TPutRouteParams>): Promise<TRouteResult> => {
  const params = await props.params;
  const { workspaceId: workspaceIdParam, responseId } = params;

  if (!responseId) {
    return {
      response: responses.badRequestResponse("Response ID is missing", undefined, true),
    };
  }

  const resolved = await resolveClientApiIds(workspaceIdParam);
  if (!resolved) {
    return {
      response: responses.notFoundResponse("Workspace", workspaceIdParam, true),
    };
  }
  const { workspaceId } = resolved;

  const validatedUpdateInput = await getValidatedResponseUpdateInput(req);
  if ("response" in validatedUpdateInput) {
    return validatedUpdateInput;
  }
  const { responseUpdateInput } = validatedUpdateInput;

  const existingResponseResult = await getExistingResponse(responseId);
  if ("response" in existingResponseResult) {
    return existingResponseResult;
  }
  const { existingResponse } = existingResponseResult;

  const surveyResult = await getSurveyForResponse(responseId, existingResponse.surveyId);
  if ("response" in surveyResult) {
    return surveyResult;
  }
  const { survey } = surveyResult;

  if (survey.workspaceId !== workspaceId) {
    return {
      response: responses.notFoundResponse("Response", responseId, true),
    };
  }

  // Mirror the POST endpoint: PIN-protected link surveys require a server-verifiable PIN token.
  // Without this, an unfinished response of a PIN survey could be updated/finalized without the PIN
  // (CWE-602, ENG-1579).
  if (survey.pin && !verifyLinkSurveyPinToken(responseUpdateInput.pinAuthToken, survey.id)) {
    return {
      response: responses.forbiddenResponse("Survey is protected by a PIN", true, {
        surveyId: survey.id,
      }),
    };
  }

  const validationResult = validateUpdateRequest(existingResponse, survey, responseUpdateInput, workspaceId);
  if (validationResult) {
    return validationResult;
  }

  const updatedResponseResult = await getUpdatedResponse(responseId, responseUpdateInput);
  if ("response" in updatedResponseResult) {
    return updatedResponseResult;
  }
  const { updatedResponse } = updatedResponseResult;

  const { quotaFull, ...responseData } = updatedResponse;

  await sendToPipeline({
    event: "responseUpdated",
    workspaceId: survey.workspaceId,
    surveyId: survey.id,
    response: responseData,
  });

  if (updatedResponse.finished) {
    await sendToPipeline({
      event: "responseFinished",
      workspaceId: survey.workspaceId,
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
