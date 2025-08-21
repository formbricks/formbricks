import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { type PresignedPostOptions, createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "@formbricks/logger";
import { createS3Client } from "./client";
import { S3_BUCKET_NAME } from "./constants";
import {
  type FileNotFoundError,
  type Result,
  type S3ClientError,
  type S3CredentialsError,
  type UnknownError,
  err,
  ok,
} from "./types/error";

const s3Client = createS3Client();

/**
 * Get a signed URL for uploading a file to S3
 * @param fileName - The name of the file to upload
 * @param contentType - The content type of the file
 * @param filePath - The path to the file in S3
 * @param isBiggerFileUploadAllowed - Whether to allow uploading bigger files
 * @returns A Result containing the signed URL and presigned fields or an error: UnknownError | S3CredentialsError | S3ClientError
 */
export const getSignedUploadUrl = async (
  fileName: string,
  contentType: string,
  filePath: string,
  maxSize?: number
): Promise<
  Result<
    {
      signedUrl: string;
      presignedFields: PresignedPostOptions["Fields"];
    },
    UnknownError | S3CredentialsError | S3ClientError
  >
> => {
  try {
    if (!s3Client) {
      logger.error("Failed to get signed upload URL: S3 client is not set");
      return err({
        code: "s3_client_error",
        message: "S3 client is not set",
      });
    }

    const postConditions: PresignedPostOptions["Conditions"] = maxSize
      ? [["content-length-range", 0, maxSize]]
      : undefined;

    if (!S3_BUCKET_NAME) {
      logger.error("Failed to get signed upload URL: S3 bucket name is not set");
      return err({
        code: "s3_credentials_error",
        message: "S3 bucket name is not set",
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
    logger.error("Failed to get signed upload URL", { error });
    const unknownError: UnknownError = {
      code: "unknown",
      message: "Failed to get signed upload URL",
    };

    return err(unknownError);
  }
};

/**
 * Get a signed URL for a file in S3
 * @param fileKey - The key of the file in S3
 * @returns A Result containing the signed URL or an error: S3CredentialsError | S3ClientError | FileNotFoundError | UnknownError
 */
export const getSignedDownloadUrl = async (
  fileKey: string
): Promise<Result<string, S3CredentialsError | S3ClientError | FileNotFoundError | UnknownError>> => {
  try {
    if (!s3Client) {
      return err({
        code: "s3_client_error",
        message: "S3 client is not set",
      });
    }

    if (!S3_BUCKET_NAME) {
      return err({
        code: "s3_credentials_error",
        message: "S3 bucket name is not set",
      });
    }

    // Check if file exists before generating signed URL
    const headObjectCommand = new HeadObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: fileKey,
    });

    try {
      await s3Client.send(headObjectCommand);
    } catch (headError: unknown) {
      logger.error("Failed to check if file exists", headError);
      if (
        (headError as Error).name === "NotFound" ||
        (headError as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404
      ) {
        return err({
          code: "file_not_found_error",
          message: `File not found: ${fileKey}`,
        });
      }

      return err({
        code: "unknown",
        message: `Failed to get signed download URL for file: ${fileKey}`,
      });
    }

    const getObjectCommand = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: fileKey,
    });

    return ok(await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 60 * 30 }));
  } catch (error) {
    logger.error("Failed to get signed download URL", { error });
    const unknownError: UnknownError = {
      code: "unknown",
      message: "Failed to get signed download URL",
    };

    return err(unknownError);
  }
};

/**
 * Delete a file from S3
 * @param fileKey - The key of the file in S3 (e.g. "surveys/123/responses/456/file.pdf")
 * @returns A Result containing the void or an error: S3CredentialsError | S3ClientError | UnknownError
 */
export const deleteFile = async (
  fileKey: string
): Promise<Result<void, S3CredentialsError | S3ClientError | UnknownError>> => {
  try {
    if (!s3Client) {
      return err({
        code: "s3_client_error",
        message: "S3 client is not set",
      });
    }

    if (!S3_BUCKET_NAME) {
      return err({
        code: "s3_credentials_error",
        message: "S3 bucket name is not set",
      });
    }

    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: fileKey,
    });

    await s3Client.send(deleteObjectCommand);

    return ok(undefined);
  } catch (error) {
    logger.error("Failed to delete file", { error });

    const unknownError: UnknownError = {
      code: "unknown",
      message: "Failed to delete file",
    };

    return err(unknownError);
  }
};
