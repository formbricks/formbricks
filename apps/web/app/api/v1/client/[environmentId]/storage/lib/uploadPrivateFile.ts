import { responses } from "@/app/lib/api/response";
import { getUploadSignedUrl } from "@/lib/storage/service";

export const uploadPrivateFile = async (
  fileName: string,
  environmentId: string,
  fileType: string,
  isBiggerFileUploadAllowed: boolean = false
) => {
  const accessType = "private"; // private files are only accessible by the user who has access to the environment
  // if s3 is not configured, we'll upload to a local folder named uploads

  try {
    const signedUrlResponse = await getUploadSignedUrl(
      fileName,
      environmentId,
      fileType,
      accessType,
      isBiggerFileUploadAllowed
    );

    return responses.successResponse({
      ...signedUrlResponse,
    });
  } catch (err) {
    return responses.internalServerErrorResponse("Internal server error");
  }
};
