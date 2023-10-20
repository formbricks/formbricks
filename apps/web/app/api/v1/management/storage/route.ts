import { responses } from "@/app/lib/api/response";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env.mjs";
import { getSignedUrlForS3Upload } from "@formbricks/lib/storage/service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/authOptions";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { generateLocalSignedUrl } from "@formbricks/lib/crypto";

// api endpoint for uploading public files
// uploaded files will be public, anyone can access the file
// uploading public files requires authentication
// use this to upload files for a specific resource, e.g. a user profile picture or a survey
// this api endpoint will return a signed url for uploading the file to s3 and another url for uploading file to the local storage

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { fileName, fileType, environmentId, allowedFileExtensions } = await req.json();

  if (!fileName) {
    return responses.badRequestResponse("fileName is required");
  }

  if (!fileType) {
    return responses.badRequestResponse("fileType is required");
  }

  if (!environmentId) {
    return responses.badRequestResponse("environmentId is required");
  }

  if (allowedFileExtensions?.length) {
    const fileExtension = fileName.split(".").pop();
    if (!fileExtension || !allowedFileExtensions.includes(fileExtension)) {
      return responses.badRequestResponse(
        `File extension is not allowed, allowed extensions are: ${allowedFileExtensions.join(", ")}`
      );
    }
  }

  // auth and upload private file
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return responses.notAuthenticatedResponse();
  }

  const isUserAuthorized = await hasUserEnvironmentAccess(session.user.id, environmentId);

  if (!isUserAuthorized) {
    return responses.unauthorizedResponse();
  }

  return await getSignedUrlForPublicFile(fileName, environmentId, fileType);
}

const getSignedUrlForPublicFile = async (fileName: string, environmentId: string, fileType: string) => {
  const accessType = "public"; // public files are accessible by anyone

  // if s3 is not configured, we'll upload to a local folder named uploads

  if (!env.S3_ACCESS_KEY || !env.S3_SECRET_KEY || !env.S3_REGION || !env.S3_BUCKET_NAME) {
    try {
      const { signature, timestamp, uuid } = generateLocalSignedUrl(fileName, environmentId, fileType);

      return responses.successResponse({
        signedUrl: new URL(`${WEBAPP_URL}/api/v1/management/storage/local`).href,
        signingData: {
          signature,
          timestamp,
          uuid,
        },
        fileUrl: new URL(`${WEBAPP_URL}/storage/${environmentId}/${accessType}/${fileName}`).href,
      });
    } catch (err) {
      if (err.name === "FileTooLargeError") {
        return responses.badRequestResponse(err.message);
      }

      return responses.internalServerErrorResponse("Internal server error");
    }
  }

  try {
    const { presignedFields, signedUrl } = await getSignedUrlForS3Upload(
      fileName,
      fileType,
      accessType,
      environmentId,
      true
    );

    return responses.successResponse({
      signedUrl,
      presignedFields,
      fileUrl: new URL(`${WEBAPP_URL}/storage/${environmentId}/${accessType}/${fileName}`).href,
    });
  } catch (err) {
    return responses.internalServerErrorResponse("Internal server error");
  }
};
