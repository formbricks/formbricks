import { checkAuth, checkForRequiredFields } from "@/app/api/v1/management/storage/lib/utils";
import { responses } from "@/app/lib/api/response";
import { TApiV1Authentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { validateFile } from "@/lib/fileValidation";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { getSignedUrlForPublicFile } from "./lib/getSignedUrl";

// api endpoint for uploading public files
// uploaded files will be public, anyone can access the file
// uploading public files requires authentication
// use this to upload files for a specific resource, e.g. a user profile picture or a survey
// this api endpoint will return a signed url for uploading the file to s3 and another url for uploading file to the local storage

export const POST = withV1ApiWrapper({
  handler: async ({ req, authentication }: { req: NextRequest; authentication: TApiV1Authentication }) => {
    let storageInput;

    try {
      storageInput = await req.json();
    } catch (error) {
      logger.error({ error, url: req.url }, "Error parsing JSON input");
      return {
        response: responses.badRequestResponse("Malformed JSON input, please check your request body"),
      };
    }

    const { fileName, fileType, environmentId, allowedFileExtensions } = storageInput;

    const requiredFieldResponse = checkForRequiredFields(environmentId, fileType, fileName);
    if (requiredFieldResponse) {
      return {
        response: requiredFieldResponse,
      };
    }

    const authResponse = await checkAuth(authentication, environmentId);
    if (authResponse) {
      return {
        response: authResponse,
      };
    }

    // Perform server-side file validation first to block dangerous file types
    const fileValidation = validateFile(fileName, fileType);
    if (!fileValidation.valid) {
      return {
        response: responses.badRequestResponse(fileValidation.error ?? "Invalid file type"),
      };
    }

    // Also perform client-specified allowed file extensions validation if provided
    if (allowedFileExtensions?.length) {
      const fileExtension = fileName.split(".").pop()?.toLowerCase();
      if (!fileExtension || !allowedFileExtensions.includes(fileExtension)) {
        return {
          response: responses.badRequestResponse(
            `File extension is not allowed, allowed extensions are: ${allowedFileExtensions.join(", ")}`
          ),
        };
      }
    }

    return {
      response: await getSignedUrlForPublicFile(fileName, environmentId, fileType),
    };
  },
});
