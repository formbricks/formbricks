import { headers } from "next/headers";
import { UAParser } from "ua-parser-js";
import { logger } from "@formbricks/logger";
import { InvalidInputError, UniqueConstraintError } from "@formbricks/types/errors";
import { TResponseWithQuotaFull } from "@formbricks/types/quota";
import { TResponseInput, ZResponseInput } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { validateSingleUseResponseInput } from "@/app/api/client/[workspaceId]/responses/lib/single-use";
import { RequestBodyTooLargeError, parseJsonBodyWithLimit } from "@/app/lib/api/request-body";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { sendToPipeline } from "@/app/lib/pipelines";
import { getSurvey } from "@/lib/survey/service";
import { getClientIpFromHeaders } from "@/lib/utils/client-ip";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";
import { formatValidationErrorsForV1Api, validateResponseData } from "@/modules/api/lib/validation";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { createQuotaFullObject } from "@/modules/ee/quotas/lib/helpers";
import { validateFileUploads } from "@/modules/storage/utils";
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
          "Invalid JSON in request body",
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

    const singleUseValidationResult = validateSingleUseResponseInput(survey, workspaceId, responseInputData);
    if (singleUseValidationResult) {
      if ("response" in singleUseValidationResult) {
        return { response: singleUseValidationResult.response };
      }
      responseInputData.singleUseId = singleUseValidationResult.singleUseId;
    }

    if (!validateFileUploads(responseInputData.data, survey.questions)) {
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
      if (survey.isCaptureIpEnabled) {
        const ipAddress = await getClientIpFromHeaders();
        meta.ipAddress = ipAddress;
      }

      response = await createResponseWithQuotaEvaluation({
        ...responseInputData,
        meta,
      });
    } catch (error) {
      if (error instanceof InvalidInputError) {
        return {
          response: responses.badRequestResponse(error.message),
        };
      } else if (error instanceof UniqueConstraintError) {
        return {
          response: responses.conflictResponse(error.message, undefined, true),
        };
      } else {
        logger.error({ error, url: req.url }, "Error creating response");
        return {
          response: responses.internalServerErrorResponse(
            error instanceof Error ? error.message : "Unknown error occurred"
          ),
        };
      }
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
