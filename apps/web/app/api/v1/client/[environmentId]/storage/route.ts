import { logger } from "@formbricks/logger";
import { ZUploadPrivateFileRequest } from "@formbricks/types/storage";
import { parseAndValidateJsonBody } from "@/app/lib/api/parse-and-validate-json-body";
import { responses } from "@/app/lib/api/response";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { MAX_FILE_UPLOAD_SIZES } from "@/lib/constants";
import { getOrganizationByEnvironmentId } from "@/lib/organization/service";
import { getSurvey } from "@/lib/survey/service";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getBiggerUploadFileSizePermission } from "@/modules/ee/license-check/lib/utils";
import { getSignedUrlForUpload } from "@/modules/storage/service";
import { getErrorResponseFromStorageError } from "@/modules/storage/utils";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse(
    {},
    true,
    // Cache CORS preflight responses for 1 hour (conservative approach)
    // Balances performance gains with flexibility for CORS policy changes
    "public, s-maxage=3600, max-age=3600"
  );
};

// api endpoint for getting a s3 signed url for uploading private files
// uploaded files will be private, only the user who has access to the environment can access the file
// uploading private files requires no authentication
// use this to let users upload files to a file upload question response for example

export const POST = withV1ApiWrapper({
  handler: async ({ req, props }: THandlerParams<{ params: Promise<{ environmentId: string }> }>) => {
    const params = await props.params;
    const { environmentId } = params;
    const parsedInputResult = await parseAndValidateJsonBody({
      request: req,
      schema: ZUploadPrivateFileRequest,
      buildInput: (jsonInput) => ({
        ...(jsonInput !== null && typeof jsonInput === "object" ? jsonInput : {}),
        environmentId,
      }),
    });

    if ("response" in parsedInputResult) {
      if (parsedInputResult.issue === "invalid_json") {
        logger.error({ error: parsedInputResult.details, url: req.url }, "Error parsing JSON input");
      } else {
        logger.error(
          { error: parsedInputResult.details, url: req.url },
          "Fields are missing or incorrectly formatted"
        );
      }

      return {
        response: parsedInputResult.response,
      };
    }

    const { fileName, fileType, surveyId } = parsedInputResult.data;

    const [survey, organization] = await Promise.all([
      getSurvey(surveyId),
      getOrganizationByEnvironmentId(environmentId),
    ]);

    if (!survey) {
      return {
        response: responses.notFoundResponse("Survey", surveyId),
      };
    }

    if (!organization) {
      return {
        response: responses.notFoundResponse("OrganizationByEnvironmentId", environmentId),
      };
    }

    if (survey.environmentId !== environmentId) {
      return {
        response: responses.badRequestResponse("Survey does not belong to this environment", undefined, true),
      };
    }

    try {
      await applyRateLimit(rateLimitConfigs.storage.uploadPerEnvironment, environmentId);
    } catch (error) {
      return {
        response: responses.tooManyRequestsResponse(
          error instanceof Error ? error.message : "Rate limit exceeded",
          true
        ),
      };
    }

    const isBiggerFileUploadAllowed = await getBiggerUploadFileSizePermission(organization.id);
    const maxFileUploadSize = isBiggerFileUploadAllowed
      ? MAX_FILE_UPLOAD_SIZES.big
      : MAX_FILE_UPLOAD_SIZES.standard;

    const signedUrlResponse = await getSignedUrlForUpload(
      fileName,
      environmentId,
      fileType,
      "private",
      maxFileUploadSize
    );

    if (!signedUrlResponse.ok) {
      logger.error({ error: signedUrlResponse.error }, "Error getting signed url for upload");
      const errorResponse = getErrorResponseFromStorageError(signedUrlResponse.error, { fileName });
      return errorResponse.status >= 500
        ? {
            response: errorResponse,
            error: signedUrlResponse.error,
          }
        : {
            response: errorResponse,
          };
    }

    return {
      response: responses.successResponse(signedUrlResponse.data),
    };
  },
  customRateLimitConfig: rateLimitConfigs.storage.upload,
});
