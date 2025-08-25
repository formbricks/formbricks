import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import {
  type PresignedPost,
  type PresignedPostOptions,
  createPresignedPost,
} from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "@formbricks/logger";
import { ErrorCode, type Result, type StorageError, err, ok } from "../types/error";
import { createS3Client } from "./client";
import { S3_BUCKET_NAME } from "./constants";

const s3Client = createS3Client();

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
    if (!s3Client) {
      logger.error("Failed to get signed upload URL: S3 client is not set");
      return err({
        code: ErrorCode.S3ClientError,
      });
    }

    const postConditions: PresignedPostOptions["Conditions"] = maxSize
      ? [["content-length-range", 0, maxSize]]
      : undefined;

    if (!S3_BUCKET_NAME) {
      logger.error("Failed to get signed upload URL: S3 bucket name is not set");
      return err({
        code: ErrorCode.S3CredentialsError,
      });
    }

    const { fields, url } = await createPresignedPost(s3Client, {
      Expires: 2 * 60, // 2 minutes
      Bucket: S3_BUCKET_NAME,
      Key: `${filePath}/${fileName}`,
      Fields: {
        "Content-Type": contentType,
        "Content-Encoding": "base64",
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
      code: ErrorCode.Unknown,
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
    if (!s3Client) {
      return err({
        code: ErrorCode.S3ClientError,
      });
    }

    if (!S3_BUCKET_NAME) {
      return err({
        code: ErrorCode.S3CredentialsError,
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
          code: ErrorCode.FileNotFoundError,
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
      code: ErrorCode.Unknown,
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
    if (!s3Client) {
      return err({
        code: ErrorCode.S3ClientError,
      });
    }

    if (!S3_BUCKET_NAME) {
      return err({
        code: ErrorCode.S3CredentialsError,
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
      code: ErrorCode.Unknown,
    });
  }
};

export const deleteFilesByPrefix = async (prefix: string): Promise<Result<void, StorageError>> => {
  try {
    if (!s3Client) {
      return err({
        code: ErrorCode.S3ClientError,
      });
    }

    if (!S3_BUCKET_NAME) {
      return err({
        code: ErrorCode.S3CredentialsError,
      });
    }

    const keys: { Key: string }[] = [];
    let continuationToken: string | undefined;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition -- We want to loop until the continuation token is undefined
    while (true) {
      const listObjectsCommand = new ListObjectsV2Command({
        Bucket: S3_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const page = await s3Client.send(listObjectsCommand);
      const pageKeys = page.Contents?.flatMap((obj) => (obj.Key ? [{ Key: obj.Key }] : [])) ?? [];
      keys.push(...pageKeys);

      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;

      if (!continuationToken) {
        break;
      }
    }

    if (keys.length === 0) {
      return ok(undefined);
    }

    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);

      const deleteObjectsCommand = new DeleteObjectsCommand({
        Bucket: S3_BUCKET_NAME,
        Delete: {
          Objects: batch,
        },
      });

      await s3Client.send(deleteObjectsCommand);
    }

    return ok(undefined);
  } catch (error) {
    logger.error({ error }, "Failed to delete files by prefix");

    return err({
      code: ErrorCode.Unknown,
    });
  }
};
