import { randomUUID } from "crypto";
import { logger } from "@formbricks/logger";
import {
  type FileStreamResult,
  type StorageError,
  StorageErrorCode,
  deleteFile as deleteFileFromS3,
  deleteFilesByPrefix,
  getFileStream,
  getSignedUploadUrl,
} from "@formbricks/storage";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TAccessType } from "@formbricks/types/storage";
import { sanitizeFileName } from "./utils";

export const getSignedUrlForUpload = async (
  fileName: string,
  workspaceId: string,
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
      `${workspaceId}/${accessType}`,
      maxFileUploadSize
    );

    if (!signedUrlResult.ok) {
      return signedUrlResult;
    }

    // Return relative path - can be resolved to absolute URL at runtime when needed
    return ok({
      signedUrl: signedUrlResult.data.signedUrl,
      presignedFields: signedUrlResult.data.presignedFields,
      fileUrl: `/storage/${workspaceId}/${accessType}/${encodeURIComponent(updatedFileName)}`,
    });
  } catch (error) {
    logger.error({ error }, "Error getting signed url for upload");

    return err({
      code: StorageErrorCode.Unknown,
    });
  }
};

/**
 * Get a file stream for downloading/streaming files directly.
 * Use this instead of signed URL redirect for Next.js Image component compatibility.
 *
 * Tries the primary ID path first. If the file is not found and a fallbackId is provided,
 * retries with the fallback path. This supports backwards compatibility: new uploads use
 * workspaceId paths while old files may still live under environmentId paths.
 */
export const getFileStreamForDownload = async (
  fileName: string,
  primaryId: string,
  accessType: TAccessType,
  fallbackId?: string
): Promise<Result<FileStreamResult, StorageError>> => {
  try {
    const fileNameDecoded = decodeURIComponent(fileName);
    const primaryKey = `${primaryId}/${accessType}/${fileNameDecoded}`;

    const streamResult = await getFileStream(primaryKey);

    if (!streamResult.ok && streamResult.error.code === StorageErrorCode.FileNotFoundError && fallbackId) {
      const fallbackKey = `${fallbackId}/${accessType}/${fileNameDecoded}`;
      return await getFileStream(fallbackKey);
    }

    return streamResult;
  } catch (error) {
    logger.error({ error }, "Error getting file stream for download");

    return err({
      code: StorageErrorCode.Unknown,
    });
  }
};

// Deletes a file from S3. Tries the primary ID path first; if the file is not found and a
// fallbackId is provided, retries with the fallback path (backwards compat for old environmentId paths).
export const deleteFile = async (
  primaryId: string,
  accessType: TAccessType,
  fileName: string,
  fallbackId?: string
) => {
  const result = await deleteFileFromS3(`${primaryId}/${accessType}/${fileName}`);

  if (!result.ok && result.error.code === StorageErrorCode.FileNotFoundError && fallbackId) {
    return await deleteFileFromS3(`${fallbackId}/${accessType}/${fileName}`);
  }

  return result;
};

// Deletes all files for a workspace — cleans up both workspaceId-prefixed (new uploads) and
// environmentId-prefixed (legacy uploads) paths. Errors are not thrown; callers should check results.
export const deleteFilesByWorkspaceId = async (workspaceId: string, environmentIds: string[]) => {
  const results = await Promise.all([
    deleteFilesByPrefix(workspaceId),
    ...environmentIds.map((envId) => deleteFilesByPrefix(envId)),
  ]);

  // Return the first error if any, otherwise success
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
  }

  return results[0];
};
