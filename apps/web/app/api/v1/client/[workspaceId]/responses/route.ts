import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";
import { logger } from "@formbricks/logger";
import { TResponseWithQuotaFull } from "@formbricks/types/quota";
import {
  TClientResponseInput,
  TResponseInput,
  ZClientResponseInput,
  isPlainRecord,
  pickAutoCapturedResponseMeta,
} from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  canFoldSubmission,
  findRecentDuplicateResponse,
} from "@/app/api/client/[workspaceId]/responses/lib/duplicate-response";
import { validateSingleUseResponseInput } from "@/app/api/client/[workspaceId]/responses/lib/single-use";
import { handleApiError } from "@/app/lib/api/handle-api-error";
import { RequestBodyTooLargeError, parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { sendToPipeline } from "@/app/lib/pipelines";
import { applyAnonymizePolicy } from "@/lib/response/anonymize";
import { resolveResponseCountry } from "@/lib/response/country";
import { applyIngestContractToResponseInput } from "@/lib/response/ingest";
import { getSurvey } from "@/lib/survey/service";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";
import { formatValidationErrorsForV1Api, validateResponseData } from "@/modules/api/lib/validation";
import { verifyResponseRecaptcha } from "@/modules/api/lib/verify-response-recaptcha";
import { getOpenedByCreativeMeta } from "@/modules/ee/creatives/lib/attribution";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { createQuotaFullObject } from "@/modules/ee/quotas/lib/helpers";
import { validateClientFileUploads } from "@/modules/storage/utils";
import { verifyLinkSurveyPinToken } from "@/modules/survey/link/lib/pin-token";
import { enforceVerifiedEmailGate } from "@/modules/survey/link/lib/verify-email-gate";
import { getContactByUserId } from "./lib/contact";
import { createResponseWithQuotaEvaluation } from "./lib/response";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse(
    {},
    true,
    // Cache CORS preflight responses for 1 hour (conservative approach)
    // Balances performance gains with flexibility for CORS policy changes
    "public, s-maxage=3600, max-age=3600"
  );
};

const validateResponse = (
  responseInputData: TClientResponseInput,
  survey: TSurvey,
  invalidCalElementId: string | undefined
) => {
  // A booking holding a value Postgres cannot store (see `applyIngestContractToResponseInput`).
  if (invalidCalElementId) {
    return {
      response: responses.badRequestResponse(
        "Invalid booking details",
        { elementId: invalidCalElementId },
        true
      ),
    };
  }

  // Validate response data against validation rules
  const validationErrors = validateResponseData(
    survey.blocks,
    responseInputData.data,
    responseInputData.language ?? "en",
    survey.questions,
    responseInputData.notShown
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

/** The request body, or the 413 or 400 response that refuses it. */
const parseClientResponseBody = async (
  req: Request
): Promise<{ responseInput: Record<string, unknown> } | { response: Response }> => {
  try {
    return { responseInput: await parseJsonBodyWithLimit<Record<string, unknown>>(req) };
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return {
        response: responses.payloadTooLargeResponse("Payload Too Large", { error: error.message }, true),
      };
    }

    return {
      response: responses.badRequestResponse(
        "Malformed JSON input, please check your request body",
        { error: error instanceof Error ? error.message : "Unknown error occurred" },
        true
      ),
    };
  }
};

/** User identification is an enterprise feature (contacts). */
const isUserIdentificationAllowed = async (workspaceId: string): Promise<boolean> => {
  const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
  return getIsContactsEnabled(organizationId);
};

/** Why the survey does not take this submission (another workspace, not running, PIN), or null. */
const getSurveySubmissionRefusal = (
  survey: TSurvey,
  workspaceId: string,
  pinAuthToken: string | null | undefined
): { response: Response } | null => {
  if (survey.workspaceId !== workspaceId) {
    return {
      response: responses.badRequestResponse(
        "Survey is part of another workspace",
        {
          workspaceId,
        },
        true
      ),
    };
  }

  if (survey.status !== "inProgress") {
    return {
      response: responses.forbiddenResponse("Survey is not accepting submissions", true, {
        surveyId: survey.id,
      }),
    };
  }

  if (survey.pin && !verifyLinkSurveyPinToken(pinAuthToken, survey.id)) {
    return {
      response: responses.forbiddenResponse("Survey is protected by a PIN", true, { surveyId: survey.id }),
    };
  }
  return null;
};

/** The response's meta: the client's captured context plus what the server derives and checks. */
const buildClientResponseMeta = async ({
  responseInputData,
  survey,
  workspaceId,
  req,
  requestHeaders,
}: {
  responseInputData: ReturnType<(typeof ZClientResponseInput)["parse"]>;
  survey: TSurvey;
  workspaceId: string;
  req: Request;
  requestHeaders: Headers;
}): Promise<TResponseInput["meta"]> => {
  const userAgent = req.headers.get("user-agent") || undefined;
  const agent = new UAParser(userAgent);

  const country = resolveResponseCountry(responseInputData?.meta?.country, requestHeaders);

  const meta: TResponseInput["meta"] = {
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
    country: country,
    action: responseInputData?.meta?.action,
    // Only the creative's id comes from the client; the server checks it and stamps the name.
    ...(responseInputData.meta?.openedByCreativeId
      ? await getOpenedByCreativeMeta({
          creativeId: responseInputData.meta.openedByCreativeId,
          workspaceId,
          surveyId: survey.id,
        })
      : {}),
  };

  // Capture IP address if the survey has IP capture enabled
  // Server-derived IP always overwrites any client-provided value
  if (survey.isCaptureIpEnabled && !survey.isAnonymizeResponsesEnabled) {
    const ipAddress = await getClientIpFromHeaders();
    meta.ipAddress = ipAddress;
  }

  return meta;
};

/**
 * A single-use link's submission must carry a valid single use id; on success the input carries
 * the canonical one. The refusal, or null.
 */
const applySingleUseValidation = (
  survey: TSurvey,
  workspaceId: string,
  responseInputData: ReturnType<(typeof ZClientResponseInput)["parse"]>
): { response: Response } | null => {
  const singleUseValidationResult = validateSingleUseResponseInput(survey, workspaceId, responseInputData);
  if (!singleUseValidationResult) return null;
  if ("response" in singleUseValidationResult) {
    return { response: singleUseValidationResult.response };
  }
  responseInputData.singleUseId = singleUseValidationResult.singleUseId;
  return null;
};

/** The finished response this submission repeats, if it can fold into one (ENG-1147). */
const findFoldableDuplicate = async (
  responseInputData: TClientResponseInput,
  survey: TSurvey,
  workspaceId: string
) => {
  const contact =
    responseInputData.userId &&
    canFoldSubmission({ surveyType: survey.type, finished: responseInputData.finished })
      ? await getContactByUserId(workspaceId, responseInputData.userId)
      : null;
  return findRecentDuplicateResponse({
    surveyId: survey.id,
    surveyType: survey.type,
    contactId: contact?.id,
    data: responseInputData.data,
    finished: responseInputData.finished,
    calBookings: responseInputData.calBookings,
  });
};

/** The pipeline events of a new response: created, and finished when it is. */
const sendResponsePipelineEvents = async (
  workspaceId: string,
  responseData: Omit<TResponseWithQuotaFull, "quotaFull">,
  finished: boolean
): Promise<void> => {
  await sendToPipeline({
    event: "responseCreated",
    workspaceId,
    surveyId: responseData.surveyId,
    response: responseData,
  });

  if (finished) {
    await sendToPipeline({
      event: "responseFinished",
      workspaceId,
      surveyId: responseData.surveyId,
      response: responseData,
    });
  }
};

export const POST = withV1ApiWrapper({
  handler: async ({ req, props }: THandlerParams<{ params: Promise<{ workspaceId: string }> }>) => {
    const params = await props.params;
    const requestHeaders = await headers();
    const parsedBody = await parseClientResponseBody(req);
    if ("response" in parsedBody) return parsedBody;
    const { responseInput } = parsedBody;

    // Resolve: accepts either an environmentId (old SDK) or a workspaceId (new SDK)
    const resolved = await resolveClientApiIds(params.workspaceId);
    if (!resolved) {
      return {
        response: responses.notFoundResponse("Workspace", params.workspaceId),
      };
    }
    const { workspaceId } = resolved;

    // Set on the parsed body rather than spread into a copy: a copy is a pass over every key the caller
    // sent, before the schema has bounded any of them.
    if (isPlainRecord(responseInput)) {
      responseInput.workspaceId = workspaceId;
    }
    // The survey's create input: `ZResponseInput` plus Mark as low quality (ENG-6933) and the not-shown
    // record (ENG-6936).
    const responseInputValidation = ZClientResponseInput.safeParse(responseInput);

    if (!responseInputValidation.success) {
      return {
        response: responses.badRequestResponse(
          "Fields are missing or incorrectly formatted",
          transformErrorToDetails(responseInputValidation.error),
          true
        ),
      };
    }

    const responseInputData: TClientResponseInput = responseInputValidation.data;

    if (responseInputData.userId && !(await isUserIdentificationAllowed(workspaceId))) {
      return {
        response: responses.forbiddenResponse(
          "User identification is only available for enterprise users.",
          true
        ),
      };
    }

    // get and check survey
    const survey = await getSurvey(responseInputData.surveyId);
    if (!survey) {
      return {
        response: responses.notFoundResponse("Survey", responseInputData.surveyId, true),
      };
    }
    const surveyRefusal = getSurveySubmissionRefusal(survey, workspaceId, responseInputData.pinAuthToken);
    if (surveyRefusal) return surveyRefusal;

    // The Embedded Data ingest contract (ENG-1845), re-run server-side because this endpoint is
    // public and the renderer's filtering is never trusted. Ahead of validation and quota evaluation
    // so both see the values that will be stored, and ahead of the verified-email gate below, which
    // has to be the last writer: `verifiedEmail` is a forbidden field name, so no survey declares it
    // and the contract would drop it.
    // The same step splits a Cal element's booking record out of `data` (the stored answer stays the
    // string "booked"), before validation, the duplicate fold and quotas.
    const ingestResult = applyIngestContractToResponseInput(survey, responseInputData);

    // Email verification, like the PIN above, has to be enforced here and not only in the renderer:
    // this endpoint is public, so a caller could otherwise submit with any `verifiedEmail` they like.
    // Shared with the v2 endpoint so the two versions cannot drift apart.
    const verifiedEmailErrorResponse = enforceVerifiedEmailGate({
      survey,
      responseData: responseInputData.data,
      metaUrl: responseInputData.meta?.url,
    });
    if (verifiedEmailErrorResponse) {
      return { response: verifiedEmailErrorResponse };
    }

    // Same gate the v2 endpoint applies — without it, posting to the v1 URL opts the caller out of the
    // survey's spam protection entirely.
    const recaptchaErrorResponse = await verifyResponseRecaptcha({
      survey,
      workspaceId,
      recaptchaToken: responseInputData.recaptchaToken,
    });
    if (recaptchaErrorResponse) {
      return { response: recaptchaErrorResponse };
    }

    const singleUseRefusal = applySingleUseValidation(survey, workspaceId, responseInputData);
    if (singleUseRefusal) return singleUseRefusal;

    if (
      !validateClientFileUploads({
        data: responseInputData.data,
        workspaceId,
        surveyId: survey.id,
        blocks: survey.blocks,
        questions: survey.questions,
      })
    ) {
      return {
        response: responses.badRequestResponse("Invalid file upload response"),
      };
    }

    const validationResult = validateResponse(responseInputData, survey, ingestResult.invalidCalElementId);
    if (validationResult) {
      return validationResult;
    }

    // A mail scanner's click-time check and the recipient's own click submit the same prefilled
    // answer seconds apart (ENG-1147). Hand the second one the first finished response's id, so no
    // second row is stored and no second pipeline run fires.
    const duplicate = await findFoldableDuplicate(responseInputData, survey, workspaceId);
    if (duplicate) {
      logger.info({ surveyId: survey.id, responseId: duplicate.id }, "Folded duplicate response submission");
      return {
        response: responses.successResponse({ id: duplicate.id, ...createQuotaFullObject() }, true),
      };
    }

    let response: TResponseWithQuotaFull;
    try {
      const meta = await buildClientResponseMeta({
        responseInputData,
        survey,
        workspaceId,
        req,
        requestHeaders,
      });

      const metaToStore = applyAnonymizePolicy(meta, survey.isAnonymizeResponsesEnabled);

      response = await createResponseWithQuotaEvaluation(
        {
          ...responseInputData,
          meta: metaToStore,
        },
        ingestResult.flags
      );
    } catch (error) {
      return handleApiError(error, { cors: true });
    }

    const { quotaFull, ...responseData } = response;

    await sendResponsePipelineEvents(workspaceId, responseData, responseInputData.finished);

    const quotaObj = createQuotaFullObject(quotaFull);

    const responseDataWithQuota = {
      id: responseData.id,
      ...quotaObj,
    };

    return {
      response: responses.successResponse(responseDataWithQuota, true),
    };
  },
});
