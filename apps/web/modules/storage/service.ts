import { randomUUID } from "crypto";
import { logger } from "@formbricks/logger";
import {
  StorageErrorCode,
  deleteFile as deleteFileFromS3,
  deleteFilesByPrefix,
  getFileStream,
  getSignedUploadUrl,
} from "@formbricks/storage";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TAccessType } from "@formbricks/types/storage";
import { sanitizeFileName } from "./utils";

type TStorageError = {
  code: (typeof StorageErrorCode)[keyof typeof StorageErrorCode];
};
type TGetFileStreamResult = Result<
  {
    body: ReadableStream<Uint8Array>;
    contentType: string;
    contentLength: number;
  },
  TStorageError
>;

const normalizeStorageError = (error: { code?: unknown }): TStorageError => ({
  code:
    typeof error.code === "string"
      ? (error.code as (typeof StorageErrorCode)[keyof typeof StorageErrorCode])
      : StorageErrorCode.Unknown,
});

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
    TStorageError
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

    if ("error" in signedUrlResult) {
      return err(normalizeStorageError(signedUrlResult.error));
    }

    // Return relative path - can be resolved to absolute URL at runtime when needed
    return ok({
      signedUrl: signedUrlResult.data.signedUrl,
      presignedFields: signedUrlResult.data.presignedFields,
      fileUrl: `/storage/${environmentId}/${accessType}/${encodeURIComponent(updatedFileName)}`,
    });
  } catch (error) {
    logger.error({ error }, "Error getting signed url for upload");

    return err({
      code: StorageErrorCode.Unknown,
    });
  }
};

/**
 * Get a file stream for downloading/streaming files directly
 * Use this instead of signed URL redirect for Next.js Image component compatibility
 */
export const getFileStreamForDownload = async (
  fileName: string,
  environmentId: string,
  accessType: TAccessType
): Promise<TGetFileStreamResult> => {
  try {
    const fileNameDecoded = decodeURIComponent(fileName);
    const fileKey = `${environmentId}/${accessType}/${fileNameDecoded}`;

    const streamResult = await getFileStream(fileKey);

    if ("error" in streamResult) {
      return err(normalizeStorageError(streamResult.error));
    }

    return ok(streamResult.data);
  } catch (error) {
    logger.error({ error }, "Error getting file stream for download");

    return err({
      code: StorageErrorCode.Unknown,
    });
  }
};

// We don't need to return or throw any errors, even if the file doesn't exist, we should not fail the request, nor log any errors, those will be handled by the deleteFile function
export const deleteFile = async (
  environmentId: string,
  accessType: TAccessType,
  fileName: string
): Promise<Result<void, TStorageError>> => {
  const result = await deleteFileFromS3(`${environmentId}/${accessType}/${fileName}`);

  if ("error" in result) {
    return err(normalizeStorageError(result.error));
  }

  return ok(undefined);
};

// We don't need to return or throw any errors, even if the files don't exist, we should not fail the request, nor log any errors, those will be handled by the deleteFilesByPrefix function
export const deleteFilesByEnvironmentId = async (
  environmentId: string
): Promise<Result<void, TStorageError>> => {
  const result = await deleteFilesByPrefix(environmentId);

  if ("error" in result) {
    return err(normalizeStorageError(result.error));
  }

  return ok(undefined);
};
