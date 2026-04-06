import { logger } from "@formbricks/logger";
import { TUploadPrivateFileRequest, ZUploadPrivateFileRequest } from "@formbricks/types/storage";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { MAX_FILE_UPLOAD_SIZES } from "@/lib/constants";
import { getOrganization } from "@/lib/organization/service";
import { getSurvey } from "@/lib/survey/service";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { resolveClientApiIds } from "@/lib/utils/resolve-client-id";
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

    // Resolve: accepts either an environmentId (old SDK) or a workspaceId (new SDK)
    const resolved = await resolveClientApiIds(params.environmentId);
    if (!resolved) {
      return {
        response: responses.notFoundResponse("Environment", params.environmentId),
      };
    }
    const { environmentId, workspaceId } = resolved;

    let jsonInput: TUploadPrivateFileRequest;

    try {
      jsonInput = await req.json();
    } catch (error) {
      logger.error({ error, url: req.url }, "Error parsing JSON input");
      return {
        response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
      };
    }

    const parsedInputResult = ZUploadPrivateFileRequest.safeParse({
      ...jsonInput,
      environmentId,
      workspaceId,
    });

    if (!parsedInputResult.success) {
      const errorDetails = transformErrorToDetails(parsedInputResult.error);

      logger.error({ error: errorDetails }, "Fields are missing or incorrectly formatted");

      return {
        response: responses.badRequestResponse(
          "Fields are missing or incorrectly formatted",
          errorDetails,
          true
        ),
      };
    }

    const { fileName, fileType, surveyId } = parsedInputResult.data;

    const [survey, organizationId] = await Promise.all([
      getSurvey(surveyId),
      getOrganizationIdFromWorkspaceId(workspaceId),
    ]);
    const organization = await getOrganization(organizationId);

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

    if (survey.workspaceId !== workspaceId) {
      return {
        response: responses.badRequestResponse(
          "Survey does not belong to the workspace",
          { surveyId, workspaceId },
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
      resolved.workspaceId,
      fileType,
      "private",
      maxFileUploadSize
    );

    if (!signedUrlResponse.ok) {
      logger.error({ error: signedUrlResponse.error }, "Error getting signed url for upload");
      const errorResponse = getErrorResponseFromStorageError(signedUrlResponse.error, { fileName });
      return {
        response: errorResponse,
      };
    }

    return {
      response: responses.successResponse(signedUrlResponse.data),
    };
  },
  customRateLimitConfig: rateLimitConfigs.storage.upload,
});
