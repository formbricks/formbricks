import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";
import { logger } from "@formbricks/logger";
import { ZEnvironmentId } from "@formbricks/types/environment";
import { InvalidInputError } from "@formbricks/types/errors";
import type { TResponseWithQuotaFull } from "@formbricks/types/quota";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { checkSurveyValidity } from "@/app/api/v2/client/[environmentId]/responses/lib/utils";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { enqueueResponsePipelineEvents } from "@/app/lib/pipelines";
import { getSurvey } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { formatValidationErrorsForV1Api, validateResponseData } from "@/modules/api/lib/validation";
import { validateOtherOptionLengthForMultipleChoice } from "@/modules/api/v2/lib/element";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { createQuotaFullObject } from "@/modules/ee/quotas/lib/helpers";
import { type TResponseInputV2, ZResponseInputV2 } from "../types/response";
import { createResponseWithQuotaEvaluation } from "./response";

const createValidationResponse = (details: { [key: string]: string }): Response =>
  responses.badRequestResponse("Fields are missing or incorrectly formatted", details, true);

const isInvalidInputError = (error: unknown): error is InvalidInputError =>
  error instanceof InvalidInputError || (error instanceof Error && error.name === "InvalidInputError");

const parseResponseInput = async (
  req: Request,
  environmentId: string
): Promise<Response | TResponseInputV2> => {
  let responseInput;

  try {
    responseInput = await req.json();
  } catch (error) {
    return responses.badRequestResponse(
      "Invalid JSON in request body",
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      true
    );
  }

  const environmentIdValidation = ZEnvironmentId.safeParse(environmentId);
  if (!environmentIdValidation.success) {
    return createValidationResponse(transformErrorToDetails(environmentIdValidation.error));
  }

  const responseInputValidation = ZResponseInputV2.safeParse({ ...responseInput, environmentId });
  if (!responseInputValidation.success) {
    return createValidationResponse(transformErrorToDetails(responseInputValidation.error));
  }

  return responseInputValidation.data;
};

const ensureContactsAccess = async (
  environmentId: string,
  responseInputData: TResponseInputV2
): Promise<Response | undefined> => {
  if (!responseInputData.contactId) {
    return;
  }

  const organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
  const isContactsEnabled = await getIsContactsEnabled(organizationId);

  if (!isContactsEnabled) {
    return responses.forbiddenResponse("User identification is only available for enterprise users.", true);
  }
};

const getSurveyForResponseCreation = async (
  environmentId: string,
  responseInputData: TResponseInputV2
): Promise<Response | TSurvey> => {
  const survey = await getSurvey(responseInputData.surveyId);
  if (!survey) {
    return responses.notFoundResponse("Survey", responseInputData.surveyId, true);
  }

  const surveyCheckResult = await checkSurveyValidity(survey, environmentId, responseInputData);
  if (surveyCheckResult) {
    return surveyCheckResult;
  }

  return survey;
};

const getResponseCreationValidationError = (
  responseInputData: TResponseInputV2,
  survey: TSurvey
): Response | undefined => {
  const otherResponseInvalidQuestionId = validateOtherOptionLengthForMultipleChoice({
    responseData: responseInputData.data,
    surveyQuestions: getElementsFromBlocks(survey.blocks),
    responseLanguage: responseInputData.language,
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

  const validationErrors = validateResponseData(
    survey.blocks,
    responseInputData.data,
    responseInputData.language ?? "en",
    survey.questions
  );

  if (validationErrors) {
    return responses.badRequestResponse(
      "Validation failed",
      formatValidationErrorsForV1Api(validationErrors),
      true
    );
  }
};

const buildResponseMeta = async (
  req: Request,
  requestHeaders: Headers,
  responseInputData: TResponseInputV2,
  survey: TSurvey
): Promise<TResponseInputV2["meta"]> => {
  const userAgent = req.headers.get("user-agent") || undefined;
  const agent = new UAParser(userAgent);
  const country =
    requestHeaders.get("CF-IPCountry") ||
    requestHeaders.get("X-Vercel-IP-Country") ||
    requestHeaders.get("CloudFront-Viewer-Country") ||
    undefined;

  const meta: TResponseInputV2["meta"] = {
    source: responseInputData.meta?.source,
    url: responseInputData.meta?.url,
    userAgent: {
      browser: agent.getBrowser().name,
      device: agent.getDevice().type || "desktop",
      os: agent.getOS().name,
    },
    country,
    action: responseInputData.meta?.action,
  };

  if (survey.isCaptureIpEnabled) {
    meta.ipAddress = await getClientIpFromHeaders();
  }

  return meta;
};

const createResponseSafely = async (
  req: Request,
  requestHeaders: Headers,
  responseInputData: TResponseInputV2,
  survey: TSurvey
): Promise<Response | TResponseWithQuotaFull> => {
  try {
    const meta = await buildResponseMeta(req, requestHeaders, responseInputData, survey);

    return await createResponseWithQuotaEvaluation({
      ...responseInputData,
      meta,
    });
  } catch (error) {
    if (isInvalidInputError(error)) {
      return responses.badRequestResponse(error.message);
    }

    logger.error({ error, url: req.url }, "Error creating response");
    return responses.internalServerErrorResponse(
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
};

export const handleCreateResponseRequest = async ({
  environmentId,
  req,
}: {
  environmentId: string;
  req: Request;
}): Promise<Response> => {
  const responseInputData = await parseResponseInput(req, environmentId);
  if (responseInputData instanceof Response) {
    return responseInputData;
  }

  const contactsError = await ensureContactsAccess(environmentId, responseInputData);
  if (contactsError) {
    return contactsError;
  }

  const survey = await getSurveyForResponseCreation(environmentId, responseInputData);
  if (survey instanceof Response) {
    return survey;
  }

  const validationError = getResponseCreationValidationError(responseInputData, survey);
  if (validationError) {
    return validationError;
  }

  const requestHeaders = await headers();
  const response = await createResponseSafely(req, requestHeaders, responseInputData, survey);
  if (response instanceof Response) {
    return response;
  }

  const { quotaFull, ...responseData } = response;

  await enqueueResponsePipelineEvents({
    environmentId,
    events: response.finished ? ["responseCreated", "responseFinished"] : ["responseCreated"],
    responseId: responseData.id,
    surveyId: responseData.surveyId,
  });

  const quotaObj = createQuotaFullObject(quotaFull);
  const responseDataWithQuota = {
    id: responseData.id,
    ...quotaObj,
  };

  return responses.successResponse(responseDataWithQuota, true);
};
