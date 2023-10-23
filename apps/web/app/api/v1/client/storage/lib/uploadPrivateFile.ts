import { env } from "@/env.mjs";
import { responses } from "@/app/lib/api/response";
import { WEBAPP_URL } from "@formbricks/lib/constants";
import { getSignedUrlForS3Upload } from "@formbricks/lib/storage/service";
import { generateLocalSignedUrl } from "@formbricks/lib/crypto";

const uploadPrivateFile = async (
  fileName: string,
  environmentId: string,
  fileType: string,
  plan: "free" | "pro"
) => {
  const accessType = "private"; // private files are only accessible by the user who has access to the environment
  // if s3 is not configured, we'll upload to a local folder named uploads

  if (!env.S3_ACCESS_KEY || !env.S3_SECRET_KEY || !env.S3_REGION || !env.S3_BUCKET_NAME) {
    try {
      const { signature, timestamp, uuid } = generateLocalSignedUrl(fileName, environmentId, fileType);

      return responses.successResponse({
        signedUrl: `${WEBAPP_URL}/api/v1/client/storage/local`,
        signingData: {
          signature,
          timestamp,
          uuid,
        },
        fileUrl: new URL(`${WEBAPP_URL}/storage/${environmentId}/${accessType}/${fileName}`).href,
      });
    } catch (err) {
      return responses.internalServerErrorResponse(err.message);
    }
  }

  try {
    const signedUrl = await getSignedUrlForS3Upload(
      fileName,
      fileType,
      accessType,
      environmentId,
      false,
      plan
    );

    return responses.successResponse({
      signedUrl,
      fileUrl: new URL(`${WEBAPP_URL}/storage/${environmentId}/${accessType}/${fileName}`).href,
    });
  } catch (err) {
    return responses.internalServerErrorResponse(err.message);
  }
};

export default uploadPrivateFile;
