import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";
import { logger } from "@formbricks/logger";
import { ZEnvironmentId } from "@formbricks/types/environment";
import { InvalidInputError } from "@formbricks/types/errors";
import type { TResponseWithQuotaFull } from "@formbricks/types/quota";
import { type TResponseInput, ZResponseInput } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import type { THandlerParams } from "@/app/lib/api/with-api-logging";
import { enqueueResponsePipelineEvents } from "@/app/lib/pipelines";
import { getSurvey } from "@/lib/survey/service";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { formatValidationErrorsForV1Api, validateResponseData } from "@/modules/api/lib/validation";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { createQuotaFullObject } from "@/modules/ee/quotas/lib/helpers";
import { validateFileUploads } from "@/modules/storage/utils";
import { createResponseWithQuotaEvaluation } from "./response";

const createValidationResponse = (details: Record<string, string>): Response =>
  responses.badRequestResponse("Fields are missing or incorrectly formatted", details, true);

const validateResponse = (responseInputData: TResponseInput, survey: TSurvey) => {
  const validationErrors = validateResponseData(
    survey.blocks,
    responseInputData.data,
    responseInputData.language ?? "en",
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

const parseResponseInput = async (
  req: Request,
  environmentId: string
): Promise<Response | TResponseInput> => {
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

  const responseInputValidation = ZResponseInput.safeParse({ ...responseInput, environmentId });
  if (!responseInputValidation.success) {
    return createValidationResponse(transformErrorToDetails(responseInputValidation.error));
  }

  return responseInputValidation.data;
};

const ensureContactsAccess = async (
  environmentId: string,
  responseInputData: TResponseInput
): Promise<Response | undefined> => {
  if (!responseInputData.userId) {
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
  surveyId: string
): Promise<Response | TSurvey> => {
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
};

const getResponseCreationValidationError = (
  responseInputData: TResponseInput,
  survey: TSurvey
): Response | undefined => {
  if (!validateFileUploads(responseInputData.data, survey.questions)) {
    return responses.badRequestResponse("Invalid file upload response", undefined, true);
  }

  return validateResponse(responseInputData, survey)?.response;
};

const buildResponseMeta = async (
  req: Request,
  requestHeaders: Headers,
  responseInputData: TResponseInput,
  survey: TSurvey
): Promise<TResponseInput["meta"]> => {
  const userAgent = req.headers.get("user-agent") || undefined;
  const agent = new UAParser(userAgent);
  const country =
    requestHeaders.get("CF-IPCountry") ||
    requestHeaders.get("X-Vercel-IP-Country") ||
    requestHeaders.get("CloudFront-Viewer-Country") ||
    undefined;

  const meta: TResponseInput["meta"] = {
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
  responseInputData: TResponseInput,
  survey: TSurvey
): Promise<Response | TResponseWithQuotaFull> => {
  try {
    const meta = await buildResponseMeta(req, requestHeaders, responseInputData, survey);

    return await createResponseWithQuotaEvaluation({
      ...responseInputData,
      meta,
    });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message, undefined, true);
    }

    logger.error({ error, url: req.url }, "Error creating response");
    return responses.internalServerErrorResponse(
      error instanceof Error ? error.message : "Unknown error occurred",
      true
    );
  }
};

export const handleCreateResponseRequest = async ({
  req,
  props,
}: THandlerParams<{ params: Promise<{ environmentId: string }> }>): Promise<{ response: Response }> => {
  const params = await props.params;
  const requestHeaders = await headers();
  const { environmentId } = params;

  const responseInputData = await parseResponseInput(req, environmentId);
  if (responseInputData instanceof Response) {
    return {
      response: responseInputData,
    };
  }

  const contactsError = await ensureContactsAccess(environmentId, responseInputData);
  if (contactsError) {
    return {
      response: contactsError,
    };
  }

  const survey = await getSurveyForResponseCreation(environmentId, responseInputData.surveyId);
  if (survey instanceof Response) {
    return {
      response: survey,
    };
  }

  const validationError = getResponseCreationValidationError(responseInputData, survey);
  if (validationError) {
    return {
      response: validationError,
    };
  }

  const response = await createResponseSafely(req, requestHeaders, responseInputData, survey);
  if (response instanceof Response) {
    return {
      response,
    };
  }

  const { quotaFull, ...responseData } = response;

  await enqueueResponsePipelineEvents({
    environmentId: survey.environmentId,
    events: response.finished ? ["responseCreated", "responseFinished"] : ["responseCreated"],
    responseId: responseData.id,
    surveyId: responseData.surveyId,
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
