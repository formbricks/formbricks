import { responses } from "@/app/lib/api/response";
import { validateFile } from "@/lib/fileValidation";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";
import { getSignedUrlForPublicFile } from "./lib/getSignedUrl";
import { checkAuth, checkForRequiredFields } from "@/app/api/v1/management/storage/lib/utils";


// api endpoint for uploading public files
// uploaded files will be public, anyone can access the file
// uploading public files requires authentication
// use this to upload files for a specific resource, e.g. a user profile picture or a survey
// this api endpoint will return a signed url for uploading the file to s3 and another url for uploading file to the local storage


export const POST = async (request: NextRequest): Promise<Response> => {
  let storageInput;

  try {
    storageInput = await request.json();
  } catch (error) {
    logger.error({ error, url: request.url }, "Error parsing JSON input");
    return responses.badRequestResponse("Malformed JSON input, please check your request body");
  }

  const { fileName, fileType, environmentId, allowedFileExtensions } = storageInput;

  const requiredFieldResponse = checkForRequiredFields(environmentId, fileType, fileName);
  if (requiredFieldResponse) return requiredFieldResponse;
  const session = await getServerSession(authOptions);

  const authResponse = await checkAuth(session, environmentId, request);
  if (authResponse) return authResponse;


  // Perform server-side file validation first to block dangerous file types
  const fileValidation = validateFile(fileName, fileType);
  if (!fileValidation.valid) {
    return responses.badRequestResponse(fileValidation.error ?? "Invalid file type");
  }

  // Also perform client-specified allowed file extensions validation if provided
  if (allowedFileExtensions?.length) {
    const fileExtension = fileName.split(".").pop()?.toLowerCase();
    if (!fileExtension || !allowedFileExtensions.includes(fileExtension)) {
      return responses.badRequestResponse(
        `File extension is not allowed, allowed extensions are: ${allowedFileExtensions.join(", ")}`
      );
    }
  }

  return await getSignedUrlForPublicFile(fileName, environmentId, fileType);
};
