import { WEBAPP_URL } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { randomUUID } from "crypto";
import { logger } from "@formbricks/logger";
import {
  type StorageError,
  StorageErrorCode,
  deleteFile as deleteFileFromS3,
  deleteFilesByPrefix,
  getSignedDownloadUrl,
  getSignedUploadUrl,
} from "@formbricks/storage";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TAccessType } from "@formbricks/types/storage";
import { sanitizeFileName } from "./utils";

export const getSignedUrlForUpload = async (
  fileName: string,
  environmentId: string,
  fileType: string,
  accessType: TAccessType,
  maxFileUploadSize: number = 1024 * 1024 * 10 // 10MB
): Promise<
  Result<
    {
      signedUrl: string;
      presignedFields: Record<string, string>;
      fileUrl: string;
    },
    StorageError
  >
> => {
  try {
    const safeFileName = sanitizeFileName(fileName);
    if (!safeFileName) {
      return err({ code: StorageErrorCode.InvalidInput });
    }
    const fileNameWithoutExtension = safeFileName.split(".").slice(0, -1).join(".");
    const fileExtension = safeFileName.split(".").pop();

    const updatedFileName = `${fileNameWithoutExtension}--fid--${randomUUID()}.${fileExtension}`;

    const signedUrlResult = await getSignedUploadUrl(
      updatedFileName,
      fileType,
      `${environmentId}/${accessType}`,
      maxFileUploadSize
    );

    if (!signedUrlResult.ok) {
      return signedUrlResult;
    }

    // Use PUBLIC_URL for public files, WEBAPP_URL for private files
    const baseUrl = accessType === "public" ? getPublicDomain() : WEBAPP_URL;

    return ok({
      signedUrl: signedUrlResult.data.signedUrl,
      presignedFields: signedUrlResult.data.presignedFields,
      fileUrl: new URL(
        `${baseUrl}/storage/${environmentId}/${accessType}/${encodeURIComponent(updatedFileName)}`
      ).href,
    });
  } catch (error) {
    logger.error({ error }, "Error getting signed url for upload");

    return err({
      code: StorageErrorCode.Unknown,
    });
  }
};

export const getSignedUrlForDownload = async (
  fileName: string,
  environmentId: string,
  accessType: TAccessType
): Promise<Result<string, StorageError>> => {
  try {
    const fileNameDecoded = decodeURIComponent(fileName);
    const fileKey = `${environmentId}/${accessType}/${fileNameDecoded}`;

    const signedUrlResult = await getSignedDownloadUrl(fileKey);

    if (!signedUrlResult.ok) {
      return signedUrlResult;
    }

    return signedUrlResult;
  } catch (error) {
    logger.error({ error }, "Error getting signed url for download");

    return err({
      code: StorageErrorCode.Unknown,
    });
  }
};

// We don't need to return or throw any errors, even if the file doesn't exist, we should not fail the request, nor log any errors, those will be handled by the deleteFile function
export const deleteFile = async (environmentId: string, accessType: TAccessType, fileName: string) =>
  await deleteFileFromS3(`${environmentId}/${accessType}/${fileName}`);

// We don't need to return or throw any errors, even if the files don't exist, we should not fail the request, nor log any errors, those will be handled by the deleteFilesByPrefix function
export const deleteFilesByEnvironmentId = async (environmentId: string) =>
  await deleteFilesByPrefix(environmentId);
