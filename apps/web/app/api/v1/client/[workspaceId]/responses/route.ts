import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";
import { TResponseWithQuotaFull } from "@formbricks/types/quota";
import { TResponseInput, ZResponseInput, pickAutoCapturedResponseMeta } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { validateSingleUseResponseInput } from "@/app/api/client/[workspaceId]/responses/lib/single-use";
import { handleApiError } from "@/app/lib/api/handle-api-error";
import { RequestBodyTooLargeError, parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { sendToPipeline } from "@/app/lib/pipelines";
import { applyAnonymizePolicy } from "@/lib/response/anonymize";
import { applyIngestContractToResponseData } from "@/lib/response/ingest";
import { getSurvey } from "@/lib/survey/service";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";
import { formatValidationErrorsForV1Api, validateResponseData } from "@/modules/api/lib/validation";
import { verifyResponseRecaptcha } from "@/modules/api/lib/verify-response-recaptcha";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { createQuotaFullObject } from "@/modules/ee/quotas/lib/helpers";
import { validateClientFileUploads } from "@/modules/storage/utils";
import { verifyLinkSurveyPinToken } from "@/modules/survey/link/lib/pin-token";
import { enforceVerifiedEmailGate } from "@/modules/survey/link/lib/verify-email-gate";
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

const validateResponse = (responseInputData: TResponseInput, survey: TSurvey) => {
  // Validate response data against validation rules
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

export const POST = withV1ApiWrapper({
  handler: async ({ req, props }: THandlerParams<{ params: Promise<{ workspaceId: string }> }>) => {
    const params = await props.params;
    const requestHeaders = await headers();
    let responseInput;
    try {
      responseInput = await parseJsonBodyWithLimit<Record<string, unknown>>(req);
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

    // Resolve: accepts either an environmentId (old SDK) or a workspaceId (new SDK)
    const resolved = await resolveClientApiIds(params.workspaceId);
    if (!resolved) {
      return {
        response: responses.notFoundResponse("Workspace", params.workspaceId),
      };
    }
    const { workspaceId } = resolved;

    const responseInputValidation = ZResponseInput.safeParse({
      ...responseInput,
      workspaceId,
    });

    if (!responseInputValidation.success) {
      return {
        response: responses.badRequestResponse(
          "Fields are missing or incorrectly formatted",
          transformErrorToDetails(responseInputValidation.error),
          true
        ),
      };
    }

    const userAgent = req.headers.get("user-agent") || undefined;
    const agent = new UAParser(userAgent);

    const country =
      requestHeaders.get("CF-IPCountry") || requestHeaders.get("CloudFront-Viewer-Country") || undefined;

    const responseInputData = responseInputValidation.data;

    if (responseInputData.userId) {
      const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
      const isContactsEnabled = await getIsContactsEnabled(organizationId);
      if (!isContactsEnabled) {
        return {
          response: responses.forbiddenResponse(
            "User identification is only available for enterprise users.",
            true
          ),
        };
      }
    }

    // get and check survey
    const survey = await getSurvey(responseInputData.surveyId);
    if (!survey) {
      return {
        response: responses.notFoundResponse("Survey", responseInputData.surveyId, true),
      };
    }
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

    if (survey.pin && !verifyLinkSurveyPinToken(responseInputData.pinAuthToken, survey.id)) {
      return {
        response: responses.forbiddenResponse("Survey is protected by a PIN", true, { surveyId: survey.id }),
      };
    }

    // The Embedded Data ingest contract (ENG-1845), re-run server-side because this endpoint is
    // public and the renderer's filtering is never trusted. Ahead of validation and quota evaluation
    // so both see the values that will be stored, and ahead of the verified-email gate below, which
    // has to be the last writer: `verifiedEmail` is a forbidden field name, so no survey declares it
    // and the contract would drop it.
    const ingestResult = applyIngestContractToResponseData(survey, responseInputData.data);
    responseInputData.data = ingestResult.data;

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

    const singleUseValidationResult = validateSingleUseResponseInput(survey, workspaceId, responseInputData);
    if (singleUseValidationResult) {
      if ("response" in singleUseValidationResult) {
        return { response: singleUseValidationResult.response };
      }
      responseInputData.singleUseId = singleUseValidationResult.singleUseId;
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
      return {
        response: responses.badRequestResponse("Invalid file upload response"),
      };
    }

    const validationResult = validateResponse(responseInputData, survey);
    if (validationResult) {
      return validationResult;
    }

    let response: TResponseWithQuotaFull;
    try {
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
      };

      // Capture IP address if the survey has IP capture enabled
      // Server-derived IP always overwrites any client-provided value
      if (survey.isCaptureIpEnabled && !survey.isAnonymizeResponsesEnabled) {
        const ipAddress = await getClientIpFromHeaders();
        meta.ipAddress = ipAddress;
      }

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

    await sendToPipeline({
      event: "responseCreated",
      workspaceId,
      surveyId: responseData.surveyId,
      response: responseData,
    });

    if (responseInputData.finished) {
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

    return {
      response: responses.successResponse(responseDataWithQuota, true),
    };
  },
});
