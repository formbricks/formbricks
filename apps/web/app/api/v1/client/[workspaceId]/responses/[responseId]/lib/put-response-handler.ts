import {
  RESPONSE_ALREADY_FINISHED_ERROR_CODE,
  ResourceNotFoundError,
  ResponseAlreadyFinishedError,
} from "@formbricks/types/errors";
import { TClientResponseUpdateInput, TResponse } from "@formbricks/types/responses";
import { TResponseNotShown } from "@formbricks/types/surveys/not-shown";
import { TSurvey } from "@formbricks/types/surveys/types";
import { type ApiErrorResult, handleApiError } from "@/app/lib/api/handle-api-error";
import { responses } from "@/app/lib/api/response";
import { THandlerParams } from "@/app/lib/api/with-api-logging";
import { sendToPipeline } from "@/app/lib/pipelines";
import { applyIngestContractToResponseInput } from "@/lib/response/ingest";
import { getResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";
import { formatValidationErrorsForV1Api, validateResponseData } from "@/modules/api/lib/validation";
import { validateOtherOptionLengthForMultipleChoice } from "@/modules/api/v2/lib/element";
import { createQuotaFullObject } from "@/modules/ee/quotas/lib/helpers";
import { validateClientFileUploads } from "@/modules/storage/utils";
import { verifyLinkSurveyPinToken } from "@/modules/survey/link/lib/pin-token";
import { VERIFIED_EMAIL_RESPONSE_KEY } from "@/modules/survey/link/lib/verify-email-gate";
import { getStoredResponseNotShown, updateResponseWithQuotaEvaluation } from "./response";
import { getValidatedResponseUpdateInput } from "./validated-response-update-input";

type TRouteResult = ApiErrorResult;

type TExistingResponseResult = { existingResponse: TResponse } | TRouteResult;
type TSurveyResult = { survey: TSurvey } | TRouteResult;
type TNotShownResult = { notShown: TResponseNotShown | null } | TRouteResult;
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

// The SDK's response queue keys off `details.code` to stop retrying, so both places that refuse a finished
// response answer the same way.
const responseAlreadyFinished = (): TRouteResult => ({
  response: responses.badRequestResponse(
    "Response is already finished",
    { code: RESPONSE_ALREADY_FINISHED_ERROR_CODE },
    true
  ),
});

const validateResponse = (
  response: TResponse,
  survey: TSurvey,
  responseUpdateInput: TClientResponseUpdateInput,
  notShown: TResponseNotShown | null
) => {
  const mergedData = {
    ...response.data,
    ...responseUpdateInput.data,
  };

  const validationErrors = validateResponseData(
    survey.blocks,
    mergedData,
    responseUpdateInput.language ?? response.language ?? "en",
    survey.questions,
    notShown
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

/**
 * The not-shown record the update leaves on the response, for validation (ENG-7332). The survey sends
 * its whole record with every update; an update without one keeps the stored record (ENG-6936).
 */
const getNotShownForValidation = async (
  responseId: string,
  responseUpdateInput: TClientResponseUpdateInput
): Promise<TNotShownResult> => {
  if (responseUpdateInput.notShown !== undefined) return { notShown: responseUpdateInput.notShown };
  try {
    return { notShown: await getStoredResponseNotShown(responseId) };
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
  responseUpdateInput: TClientResponseUpdateInput,
  workspaceId: string,
  notShown: TResponseNotShown | null,
  invalidCalElementId: string | undefined
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

  // A cheap early exit only: the authoritative check runs under the row lock in
  // updateResponseWithQuotaEvaluation, since the response can be finished after this read.
  if (existingResponse.finished) {
    return responseAlreadyFinished();
  }

  // After the two refusals above, so a closed survey or a finished response answers as it always did.
  if (invalidCalElementId) {
    return {
      response: responses.badRequestResponse(
        "Invalid booking details",
        { elementId: invalidCalElementId },
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
    surveyQuestions: survey.questions,
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

  return validateResponse(existingResponse, survey, responseUpdateInput, notShown);
};

const getUpdatedResponse = async (
  update: Parameters<typeof updateResponseWithQuotaEvaluation>[0]
): Promise<TUpdatedResponseResult> => {
  const { responseId } = update;
  try {
    const updatedResponse = await updateResponseWithQuotaEvaluation(update);
    return { updatedResponse };
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return { response: responses.notFoundResponse("Response", responseId, true) };
    }
    if (error instanceof ResponseAlreadyFinishedError) {
      return responseAlreadyFinished();
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

  // The update payload carries no `meta`, so there is no token to re-verify here. The address was
  // established authoritatively from the verification token when the response was created, so drop any
  // client-supplied value rather than letting an update overwrite it with an arbitrary address.
  if (survey.isVerifyEmailEnabled && responseUpdateInput.data) {
    delete responseUpdateInput.data[VERIFIED_EMAIL_RESPONSE_KEY];
  }

  // The Embedded Data ingest contract (ENG-1845). This boundary matters as much as the POST one and
  // is easier to miss: `validateResponseData` below only validates keys matching element ids, so
  // everything else passes through — which is how a crafted PUT could write a locked key, an unknown
  // key or an oversize value straight into `response.data`, where exports read it. Ahead of
  // validation and quota evaluation so both see the values that will be stored.
  // The same step splits a Cal element's booking record out of `data` (the stored answer stays the string
  // "booked"); on an update the details are merged into what is stored, by Question ID.
  const ingestResult = applyIngestContractToResponseInput(survey, responseUpdateInput);

  const notShownResult = await getNotShownForValidation(responseId, responseUpdateInput);
  if ("response" in notShownResult) {
    return notShownResult;
  }

  const validationResult = validateUpdateRequest(
    existingResponse,
    survey,
    responseUpdateInput,
    workspaceId,
    notShownResult.notShown,
    ingestResult.invalidCalElementId
  );
  if (validationResult) {
    return validationResult;
  }

  // `survey` was loaded from the stored response's surveyId, never from the request body.
  const updatedResponseResult = await getUpdatedResponse({
    responseId,
    workspaceId,
    surveyId: survey.id,
    responseInput: responseUpdateInput,
    ingestFlags: ingestResult.flags,
  });
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

  // The update ran on a locked, unfinished row, so `finished` here is this request's own transition: the
  // finish event fires once per response, never again for a later write.
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
