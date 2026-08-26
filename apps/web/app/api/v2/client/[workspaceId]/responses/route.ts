import { UAParser } from "ua-parser-js";
import { type TIngestFlag } from "@formbricks/types/embedded-data-ingest";
import { InvalidInputError, UniqueConstraintError } from "@formbricks/types/errors";
import { TResponseWithQuotaFull } from "@formbricks/types/quota";
import { pickAutoCapturedResponseMeta } from "@formbricks/types/responses";
import { checkSurveyValidity } from "@/app/api/v2/client/[workspaceId]/responses/lib/utils";
import { reportApiError } from "@/app/lib/api/api-error-reporter";
import { parseAndValidateJsonBody } from "@/app/lib/api/parse-and-validate-json-body";
import { responses } from "@/app/lib/api/response";
import { sendToPipeline } from "@/app/lib/pipelines";
import { applyAnonymizePolicy } from "@/lib/response/anonymize";
import { applyIngestContractToResponseData } from "@/lib/response/ingest";
import { getSurvey } from "@/lib/survey/service";
import { getElementsFromBlocks } from "@/lib/survey/utils";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";
import { formatValidationErrorsForV1Api, validateResponseData } from "@/modules/api/lib/validation";
import { validateOtherOptionLengthForMultipleChoice } from "@/modules/api/v2/lib/element";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { createQuotaFullObject } from "@/modules/ee/quotas/lib/helpers";
import { validateClientFileUploads } from "@/modules/storage/utils";
import { createResponseWithQuotaEvaluation } from "./lib/response";
import { TResponseInputV2, ZResponseInputV2 } from "./types/response";

interface Context {
  params: Promise<{
    workspaceId: string;
  }>;
}

type TResponseSurvey = NonNullable<Awaited<ReturnType<typeof getSurvey>>>;

type TValidatedResponseInputResult =
  | {
      workspaceId: string;
      responseInputData: TResponseInputV2;
    }
  | { response: Response };

const getCountry = (requestHeaders: Headers): string | undefined =>
  requestHeaders.get("CF-IPCountry") || requestHeaders.get("CloudFront-Viewer-Country") || undefined;

const getUnexpectedPublicErrorResponse = (): Response =>
  responses.internalServerErrorResponse("Something went wrong. Please try again.", true);

const parseAndValidateResponseInput = async (
  request: Request,
  workspaceId: string
): Promise<TValidatedResponseInputResult> => {
  const responseInputValidation = await parseAndValidateJsonBody({
    request,
    schema: ZResponseInputV2,
    buildInput: (jsonInput) => ({
      ...(jsonInput !== null && typeof jsonInput === "object" ? jsonInput : {}),
      workspaceId,
    }),
    malformedJsonMessage: "Invalid JSON in request body",
  });

  if ("response" in responseInputValidation) {
    return responseInputValidation;
  }

  return {
    workspaceId,
    responseInputData: responseInputValidation.data,
  };
};

const getContactsDisabledResponse = async (
  workspaceId: string,
  contactId: string | null | undefined
): Promise<Response | null> => {
  if (!contactId) {
    return null;
  }

  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  const isContactsEnabled = await getIsContactsEnabled(organizationId);

  return isContactsEnabled
    ? null
    : responses.forbiddenResponse("User identification is only available for enterprise users.", true);
};

const validateResponseSubmission = async (
  workspaceId: string,
  responseInputData: TResponseInputV2,
  survey: TResponseSurvey
): Promise<Response | null> => {
  const surveyCheckResult = await checkSurveyValidity(survey, workspaceId, responseInputData);
  if (surveyCheckResult) {
    return surveyCheckResult;
  }

  if (
    !validateClientFileUploads({
      data: responseInputData.data,
      workspaceId,
      surveyId: survey.id,
      blocks: survey.blocks,
      questions: survey.questions,
    })
  ) {
    return responses.badRequestResponse("Invalid file upload response", undefined, true);
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
  ingestFlags,
}: {
  request: Request;
  survey: TResponseSurvey;
  responseInputData: TResponseInputV2;
  country: string | undefined;
  ingestFlags: readonly TIngestFlag[];
}): Promise<TResponseWithQuotaFull | Response> => {
  const userAgent = request.headers.get("user-agent") || undefined;
  const agent = new UAParser(userAgent);

  try {
    const meta: TResponseInputV2["meta"] = {
      // The browser-runtime context the renderer snapshotted at display time (ENG-1841). This
      // literal is a whitelist — anything not re-listed here never reaches the database — so the
      // auto-captured keys have to be pulled in explicitly. Spread from the schema rather than
      // retyped key by key, so the two cannot drift.
      ...pickAutoCapturedResponseMeta(responseInputData?.meta),
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

    if (survey.isCaptureIpEnabled && !survey.isAnonymizeResponsesEnabled) {
      meta.ipAddress = await getClientIpFromHeaders();
    }

    const metaToStore = applyAnonymizePolicy(meta, survey.isAnonymizeResponsesEnabled);

    return await createResponseWithQuotaEvaluation(
      {
        ...responseInputData,
        meta: metaToStore,
      },
      ingestFlags
    );
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
  // Resolve: accepts either an environmentId (old SDK) or a workspaceId (new SDK)
  const resolved = await resolveClientApiIds(params.workspaceId);
  if (!resolved) {
    return responses.notFoundResponse("Workspace", params.workspaceId);
  }
  const { workspaceId } = resolved;

  const validatedInput = await parseAndValidateResponseInput(request, workspaceId);

  if ("response" in validatedInput) {
    return validatedInput.response;
  }

  const { responseInputData } = validatedInput;
  const country = getCountry(request.headers);

  try {
    const contactsDisabledResponse = await getContactsDisabledResponse(
      workspaceId,
      responseInputData.contactId
    );
    if (contactsDisabledResponse) {
      return contactsDisabledResponse;
    }

    const survey = await getSurvey(responseInputData.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", responseInputData.surveyId, true);
    }

    // The Embedded Data ingest contract (ENG-1845), re-run server-side because this endpoint is
    // public and the renderer's filtering is never trusted. It has to precede
    // `validateResponseSubmission` on both counts: `validateResponseData` should see the values that
    // will be stored, and `checkSurveyValidity` stamps `verifiedEmail` from the verification token —
    // a forbidden field name no survey declares, so the contract has to run before that write rather
    // than after it.
    const ingestResult = applyIngestContractToResponseData(survey, responseInputData.data);
    responseInputData.data = ingestResult.data;

    const validationResponse = await validateResponseSubmission(workspaceId, responseInputData, survey);
    if (validationResponse) {
      return validationResponse;
    }

    const createdResponse = await createResponseForRequest({
      request,
      survey,
      responseInputData,
      country,
      ingestFlags: ingestResult.flags,
    });
    if (createdResponse instanceof Response) {
      return createdResponse;
    }
    const { quotaFull, ...responseData } = createdResponse;

    await sendToPipeline({
      event: "responseCreated",
      workspaceId,
      surveyId: responseData.surveyId,
      response: responseData,
    });

    if (responseData.finished) {
      await sendToPipeline({
        event: "responseFinished",
        workspaceId,
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
