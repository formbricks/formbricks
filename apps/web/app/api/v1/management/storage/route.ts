import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { TUploadPublicFileRequest, ZUploadPublicFileRequest } from "@formbricks/types/storage";
import { checkAuth } from "@/app/api/v1/management/storage/lib/utils";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { TApiV1Authentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { getSignedUrlForUpload } from "@/modules/storage/service";
import { getErrorResponseFromStorageError } from "@/modules/storage/utils";

// api endpoint for getting a signed url for uploading a public file
// uploaded files will be public, anyone can access the file
// uploading public files requires authentication
// use this to get a signed url for uploading a public file for a specific resource, e.g. a survey's background image

export const POST = withV1ApiWrapper({
  handler: async ({ req, authentication }: { req: NextRequest; authentication: TApiV1Authentication }) => {
    let storageInput: TUploadPublicFileRequest;

    try {
      storageInput = await req.json();
    } catch (error) {
      logger.error({ error, url: req.url }, "Error parsing JSON input");
      return {
        response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
      };
    }

    const parsedInputResult = ZUploadPublicFileRequest.safeParse(storageInput);

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

    const { fileName, fileType, environmentId } = parsedInputResult.data;

    const authResponse = await checkAuth(authentication, environmentId);
    if (authResponse) {
      return {
        response: authResponse,
      };
    }

    const MAX_PUBLIC_FILE_SIZE_MB = 5;
    const maxFileUploadSize = MAX_PUBLIC_FILE_SIZE_MB * 1024 * 1024;

    const signedUrlResponse = await getSignedUrlForUpload(
      fileName,
      environmentId,
      fileType,
      "public",
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
