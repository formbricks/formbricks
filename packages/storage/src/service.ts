import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  type DeleteObjectsCommandOutput,
  GetObjectCommand,
  HeadObjectCommand,
  paginateListObjectsV2,
} from "@aws-sdk/client-s3";
import {
  type PresignedPost,
  type PresignedPostOptions,
  createPresignedPost,
} from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "@formbricks/logger";
import { type Result, type StorageError, StorageErrorCode, err, ok } from "../types/error";
import { createS3Client } from "./client";
import { S3_BUCKET_NAME } from "./constants";

/**
 * Get a signed URL for uploading a file to S3
 * @param fileName - The name of the file to upload
 * @param contentType - The content type of the file
 * @param filePath - The path to the file in S3
 * @param maxSize - The maximum size of the file to upload or undefined if no limit is desired
 * @returns A Result containing the signed URL and presigned fields or an error: StorageError
 */
export const getSignedUploadUrl = async (
  fileName: string,
  contentType: string,
  filePath: string,
  maxSize: number = 1024 * 1024 * 10 // 10MB
): Promise<
  Result<
    {
      signedUrl: string;
      presignedFields: PresignedPost["fields"];
    },
    StorageError
  >
> => {
  try {
    const s3Client = createS3Client();

    if (!s3Client) {
      logger.error("Failed to get signed upload URL: S3 client is not set");
      return err({
        code: StorageErrorCode.S3ClientError,
      });
    }

    const postConditions: PresignedPostOptions["Conditions"] = maxSize
      ? [["content-length-range", 0, maxSize]]
      : undefined;

    if (!S3_BUCKET_NAME) {
      logger.error("Failed to get signed upload URL: S3 bucket name is not set");
      return err({
        code: StorageErrorCode.S3CredentialsError,
      });
    }

    const { fields, url } = await createPresignedPost(s3Client, {
      Expires: 2 * 60, // 2 minutes
      Bucket: S3_BUCKET_NAME,
      Key: `${filePath}/${fileName}`,
      Fields: {
        "Content-Type": contentType,
        success_action_status: "201",
      },
      Conditions: postConditions,
    });

    return ok({
      signedUrl: url,
      presignedFields: fields,
    });
  } catch (error) {
    logger.error({ error }, "Failed to get signed upload URL");

    return err({
      code: StorageErrorCode.Unknown,
    });
  }
};

/**
 * Get a signed URL for a file in S3
 * @param fileKey - The key of the file in S3
 * @returns A Result containing the signed URL or an error: StorageError
 */
export const getSignedDownloadUrl = async (fileKey: string): Promise<Result<string, StorageError>> => {
  try {
    const s3Client = createS3Client();

    if (!s3Client) {
      return err({
        code: StorageErrorCode.S3ClientError,
      });
    }

    if (!S3_BUCKET_NAME) {
      return err({
        code: StorageErrorCode.S3CredentialsError,
      });
    }

    // Check if file exists before generating signed URL
    const headObjectCommand = new HeadObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: fileKey,
    });

    try {
      await s3Client.send(headObjectCommand);
    } catch (error: unknown) {
      logger.error({ error }, "Failed to check if file exists");
      if (
        (error as Error).name === "NotFound" ||
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
      ) {
        return err({
          code: StorageErrorCode.FileNotFoundError,
        });
      }

      logger.warn({ error, fileKey }, "HeadObject check failed; proceeding to sign download URL");
    }

    const getObjectCommand = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: fileKey,
    });

    return ok(await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 60 * 30 }));
  } catch (error) {
    logger.error({ error }, "Failed to get signed download URL");
    return err({
      code: StorageErrorCode.Unknown,
    });
  }
};

export interface FileStreamResult {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength: number;
}

/**
 * Get a file stream from S3
 * Use this for streaming files directly to clients instead of redirecting to signed URLs
 * @param fileKey - The key of the file in S3
 * @returns A Result containing the file stream and metadata or an error: StorageError
 */
export const getFileStream = async (fileKey: string): Promise<Result<FileStreamResult, StorageError>> => {
  try {
    const s3Client = createS3Client();

    if (!s3Client) {
      return err({
        code: StorageErrorCode.S3ClientError,
      });
    }

    if (!S3_BUCKET_NAME) {
      return err({
        code: StorageErrorCode.S3CredentialsError,
      });
    }

    const getObjectCommand = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: fileKey,
    });

    const response = await s3Client.send(getObjectCommand);

    if (!response.Body) {
      return err({
        code: StorageErrorCode.FileNotFoundError,
      });
    }

    // Convert the SDK stream to a web ReadableStream
    const webStream = response.Body.transformToWebStream();

    return ok({
      body: webStream,
      contentType: response.ContentType ?? "application/octet-stream",
      contentLength: response.ContentLength ?? 0,
    });
  } catch (error) {
    if ((error as { name?: string }).name === "NoSuchKey") {
      return err({
        code: StorageErrorCode.FileNotFoundError,
      });
    }
    logger.error({ error }, "Failed to get file stream");
    return err({
      code: StorageErrorCode.Unknown,
    });
  }
};

/**
 * Delete a file from S3
 * @param fileKey - The key of the file in S3 (e.g. "surveys/123/responses/456/file.pdf")
 * @returns A Result containing the void or an error: StorageError
 */
export const deleteFile = async (fileKey: string): Promise<Result<void, StorageError>> => {
  try {
    const s3Client = createS3Client();

    if (!s3Client) {
      return err({
        code: StorageErrorCode.S3ClientError,
      });
    }

    if (!S3_BUCKET_NAME) {
      return err({
        code: StorageErrorCode.S3CredentialsError,
      });
    }

    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: fileKey,
    });

    await s3Client.send(deleteObjectCommand);

    return ok(undefined);
  } catch (error) {
    logger.error({ error }, "Failed to delete file");

    return err({
      code: StorageErrorCode.Unknown,
    });
  }
};

/**
 * Delete all files by prefix
 * @param prefix - The prefix of the files to delete
 * @returns A Result containing the void or an error: StorageError
 */
export const deleteFilesByPrefix = async (prefix: string): Promise<Result<void, StorageError>> => {
  try {
    const s3Client = createS3Client();

    if (!s3Client) {
      return err({
        code: StorageErrorCode.S3ClientError,
      });
    }

    if (!S3_BUCKET_NAME) {
      return err({
        code: StorageErrorCode.S3CredentialsError,
      });
    }

    const normalizedPrefix = prefix.trim();
    if (!normalizedPrefix || normalizedPrefix === "/") {
      logger.error({ prefix }, "Refusing to delete files with an empty or root prefix");
      return err({
        code: StorageErrorCode.InvalidInput,
      });
    }

    const keys: { Key: string }[] = [];

    const paginator = paginateListObjectsV2(
      { client: s3Client },
      {
        Bucket: S3_BUCKET_NAME,
        Prefix: normalizedPrefix,
      }
    );

    for await (const page of paginator) {
      const pageKeys = page.Contents?.flatMap((obj) => (obj.Key ? [{ Key: obj.Key }] : [])) ?? [];
      keys.push(...pageKeys);
    }

    if (keys.length === 0) {
      return ok(undefined);
    }

    const deletionPromises: Promise<DeleteObjectsCommandOutput>[] = [];

    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);

      const deleteObjectsCommand = new DeleteObjectsCommand({
        Bucket: S3_BUCKET_NAME,
        Delete: {
          Objects: batch,
        },
      });

      deletionPromises.push(s3Client.send(deleteObjectsCommand));
    }

    const results = await Promise.all(deletionPromises);

    // Check for partial failures and log them
    let totalErrors = 0;
    let totalDeleted = 0;

    for (const result of results) {
      if (result.Deleted) {
        totalDeleted += result.Deleted.length;
        logger.debug({ count: result.Deleted.length }, "Successfully deleted objects in batch");
      }

      if (result.Errors && result.Errors.length > 0) {
        totalErrors += result.Errors.length;
        logger.error(
          {
            errors: result.Errors.map((e) => ({
              key: e.Key,
              code: e.Code,
              message: e.Message,
            })),
          },
          "Some objects failed to delete"
        );
      }
    }

    // Log the issues
    if (totalErrors > 0) {
      logger.warn({ totalErrors, totalDeleted }, "Bulk delete completed with some failures");
    }

    return ok(undefined);
  } catch (error) {
    logger.error({ error }, "Failed to delete files by prefix");

    return err({
      code: StorageErrorCode.Unknown,
    });
  }
};
