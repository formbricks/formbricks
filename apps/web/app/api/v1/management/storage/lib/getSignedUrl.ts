import { responses } from "@/app/lib/api/response";
import { getUploadSignedUrl } from "@/lib/storage/service";

export const getSignedUrlForPublicFile = async (
  fileName: string,
  environmentId: string,
  fileType: string
) => {
  const accessType = "public"; // public files are accessible by anyone

  // if s3 is not configured, we'll upload to a local folder named uploads

  try {
    const signedUrlResponse = await getUploadSignedUrl(fileName, environmentId, fileType, accessType);

    return responses.successResponse({
      ...signedUrlResponse,
    });
  } catch (err) {
    return responses.internalServerErrorResponse("Internal server error");
  }
};
