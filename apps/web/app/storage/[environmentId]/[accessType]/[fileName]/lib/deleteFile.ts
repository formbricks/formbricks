import { env } from "@/env.mjs";
import { responses } from "@/app/lib/api/response";
import { UPLOADS_DIR } from "@formbricks/lib/constants";
import { deleteFileFromLocalStorage, deleteFileFromS3 } from "@formbricks/lib/storage/service";
import { notFound } from "next/navigation";
import path from "path";
import { TAccessType } from "@formbricks/types/storage";

const deleteFile = async (environmentId: string, accessType: TAccessType, fileName: string) => {
  if (!env.S3_ACCESS_KEY || !env.S3_SECRET_KEY || !env.S3_REGION || !env.S3_BUCKET_NAME) {
    try {
      await deleteFileFromLocalStorage(path.join(UPLOADS_DIR, environmentId, accessType, fileName));
      return responses.successResponse("File deleted successfully");
    } catch (err) {
      notFound();
    }
  }

  try {
    await deleteFileFromS3(`${environmentId}/${accessType}/${fileName}`);

    return responses.successResponse("File deleted successfully");
  } catch (err) {
    if (err.name === "NoSuchKey") {
      return responses.notFoundResponse("File not found", fileName);
    } else {
      return responses.internalServerErrorResponse("Internal server error");
    }
  }
};

export default deleteFile;
