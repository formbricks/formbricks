import { env } from "@/env.mjs";
import { getSignedUrlForS3Upload } from "@formbricks/lib/storage/service";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { generateLocalSignedUrl } from "@formbricks/lib/crypto";
import { responses } from "@/app/lib/api/response";

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

export default getSignedUrlForPublicFile;
