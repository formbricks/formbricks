import { UAParser } from "ua-parser-js";
import { ZEnvironmentId } from "@formbricks/types/environment";
import { InvalidInputError, UniqueConstraintError } from "@formbricks/types/errors";
import { TResponseWithQuotaFull } from "@formbricks/types/quota";
import { checkSurveyValidity } from "@/app/api/v2/client/[environmentId]/responses/lib/utils";
import { reportApiError } from "@/app/lib/api/api-error-reporter";
import { parseAndValidateJsonBody } from "@/app/lib/api/parse-and-validate-json-body";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { sendToPipeline } from "@/app/lib/pipelines";
import { getSurvey } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { getOrganizationIdFromEnvironmentId } from "@/lib/utils/helper";
import { formatValidationErrorsForV1Api, validateResponseData } from "@/modules/api/lib/validation";
import { validateOtherOptionLengthForMultipleChoice } from "@/modules/api/v2/lib/element";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { createQuotaFullObject } from "@/modules/ee/quotas/lib/helpers";
import { createResponseWithQuotaEvaluation } from "./lib/response";
import { TResponseInputV2, ZResponseInputV2 } from "./types/response";

interface Context {
  params: Promise<{
    environmentId: string;
  }>;
}

type TResponseSurvey = NonNullable<Awaited<ReturnType<typeof getSurvey>>>;

type TValidatedResponseInputResult =
  | {
      environmentId: string;
      responseInputData: TResponseInputV2;
    }
  | { response: Response };

const getCountry = (requestHeaders: Headers): string | undefined =>
  requestHeaders.get("CF-IPCountry") || requestHeaders.get("CloudFront-Viewer-Country") || undefined;

const getUnexpectedPublicErrorResponse = (): Response =>
  responses.internalServerErrorResponse("Something went wrong. Please try again.", true);

const parseAndValidateResponseInput = async (
  request: Request,
  environmentId: string
): Promise<TValidatedResponseInputResult> => {
  const environmentIdValidation = ZEnvironmentId.safeParse(environmentId);

  if (!environmentIdValidation.success) {
    return {
      response: responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(environmentIdValidation.error),
        true
      ),
    };
  }

  const responseInputValidation = await parseAndValidateJsonBody({
    request,
    schema: ZResponseInputV2,
    buildInput: (jsonInput) => ({
      ...(jsonInput !== null && typeof jsonInput === "object" ? jsonInput : {}),
      environmentId,
    }),
    malformedJsonMessage: "Invalid JSON in request body",
  });

  if ("response" in responseInputValidation) {
    return responseInputValidation;
  }

  return {
    environmentId,
    responseInputData: responseInputValidation.data,
  };
};

const getContactsDisabledResponse = async (
  environmentId: string,
  contactId: string | null | undefined
): Promise<Response | null> => {
  if (!contactId) {
    return null;
  }

  const organizationId = await getOrganizationIdFromEnvironmentId(environmentId);
  const isContactsEnabled = await getIsContactsEnabled(organizationId);

  return isContactsEnabled
    ? null
    : responses.forbiddenResponse("User identification is only available for enterprise users.", true);
};

const validateResponseSubmission = async (
  environmentId: string,
  responseInputData: TResponseInputV2,
  survey: TResponseSurvey
): Promise<Response | null> => {
  const surveyCheckResult = await checkSurveyValidity(survey, environmentId, responseInputData);
  if (surveyCheckResult) {
    return surveyCheckResult;
  }

  const otherResponseInvalidQuestionId = validateOtherOptionLengthForMultipleChoice({
    responseData: responseInputData.data,
    surveyQuestions: getElementsFromBlocks(survey.blocks),
    responseLanguage: responseInputData.language,
  });

  if (otherResponseInvalidQuestionId) {
    return responses.badRequestResponse(
      `Response exceeds character limit`,
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

  return validationErrors
    ? responses.badRequestResponse(
        "Validation failed",
        formatValidationErrorsForV1Api(validationErrors),
        true
      )
    : null;
};

const createResponseForRequest = async ({
  request,
  survey,
  responseInputData,
  country,
}: {
  request: Request;
  survey: TResponseSurvey;
  responseInputData: TResponseInputV2;
  country: string | undefined;
}): Promise<TResponseWithQuotaFull | Response> => {
  const userAgent = request.headers.get("user-agent") || undefined;
  const agent = new UAParser(userAgent);

  try {
    const meta: TResponseInputV2["meta"] = {
      source: responseInputData?.meta?.source,
      url: responseInputData?.meta?.url,
      userAgent: {
        browser: agent.getBrowser().name,
        device: agent.getDevice().type || "desktop",
        os: agent.getOS().name,
      },
      country,
      action: responseInputData?.meta?.action,
    };

    if (survey.isCaptureIpEnabled) {
      meta.ipAddress = await getClientIpFromHeaders();
    }

    return await createResponseWithQuotaEvaluation({
      ...responseInputData,
      meta,
    });
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message, undefined, true);
    }

    if (error instanceof UniqueConstraintError) {
      return responses.conflictResponse(error.message, undefined, true);
    }

    const response = getUnexpectedPublicErrorResponse();
    reportApiError({
      request,
      status: response.status,
      error,
    });
    return response;
  }
};

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse(
    {},
    true,
    // Cache CORS preflight responses for 1 hour (conservative approach)
    // Balances performance gains with flexibility for CORS policy changes
    "public, s-maxage=3600, max-age=3600"
  );
};

export const POST = async (request: Request, context: Context): Promise<Response> => {
  const params = await context.params;
  const validatedInput = await parseAndValidateResponseInput(request, params.environmentId);

  if ("response" in validatedInput) {
    return validatedInput.response;
  }

  const { environmentId, responseInputData } = validatedInput;
  const country = getCountry(request.headers);

  try {
    const contactsDisabledResponse = await getContactsDisabledResponse(
      environmentId,
      responseInputData.contactId
    );
    if (contactsDisabledResponse) {
      return contactsDisabledResponse;
    }

    const survey = await getSurvey(responseInputData.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", responseInputData.surveyId, true);
    }

    const validationResponse = await validateResponseSubmission(environmentId, responseInputData, survey);
    if (validationResponse) {
      return validationResponse;
    }

    const createdResponse = await createResponseForRequest({
      request,
      survey,
      responseInputData,
      country,
    });
    if (createdResponse instanceof Response) {
      return createdResponse;
    }
    const { quotaFull, ...responseData } = createdResponse;

    sendToPipeline({
      event: "responseCreated",
      environmentId,
      surveyId: responseData.surveyId,
      response: responseData,
    });

    if (responseData.finished) {
      sendToPipeline({
        event: "responseFinished",
        environmentId,
        surveyId: responseData.surveyId,
        response: responseData,
      });
    }

    const quotaObj = createQuotaFullObject(quotaFull);

    const responseDataWithQuota = {
      id: responseData.id,
      ...quotaObj,
    };

    return responses.successResponse(responseDataWithQuota, true);
  } catch (error) {
    const response = getUnexpectedPublicErrorResponse();
    reportApiError({
      request,
      status: response.status,
      error,
    });
    return response;
  }
};
