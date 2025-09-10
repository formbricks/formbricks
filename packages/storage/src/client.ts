import { S3Client } from "@aws-sdk/client-s3";
import { logger } from "@formbricks/logger";
import { type Result, type StorageError, StorageErrorCode, err, ok } from "../types/error";
import {
  S3_ACCESS_KEY,
  S3_BUCKET_NAME,
  S3_ENDPOINT_URL,
  S3_FORCE_PATH_STYLE,
  S3_REGION,
  S3_SECRET_KEY,
} from "./constants";

// Cached singleton instance of S3Client
let cachedS3Client: S3Client | undefined;

/**
 * Create an S3 client from environment variables
 * @returns A Result containing the S3 client or an error: S3CredentialsError | UnknownError
 */
export const createS3ClientFromEnv = (): Result<S3Client, StorageError> => {
  try {
    if (!S3_ACCESS_KEY || !S3_SECRET_KEY || !S3_BUCKET_NAME || !S3_REGION) {
      logger.error("S3 Client: S3 credentials are not set");
      return err({
        code: StorageErrorCode.S3CredentialsError,
      });
    }

    const s3ClientInstance = new S3Client({
      credentials: { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY },
      region: S3_REGION,
      endpoint: S3_ENDPOINT_URL,
      forcePathStyle: S3_FORCE_PATH_STYLE,
    });

    return ok(s3ClientInstance);
  } catch (error) {
    logger.error({ error }, "Error creating S3 client from environment variables");
    return err({
      code: StorageErrorCode.Unknown,
    });
  }
};

/**
 * Get a cached singleton S3 client instance. Lazily initializes from env on first successful call.
 * Subsequent calls return the same instance.
 */
export const getCachedS3Client = (): S3Client | undefined => {
  if (!cachedS3Client) {
    const result = createS3ClientFromEnv();
    if (result.ok) {
      cachedS3Client = result.data;
    }
  }
  return cachedS3Client;
};

/**
 * Create an S3 client from an existing client or from environment variables
 * @param s3Client - An existing S3 client
 * @returns An S3 client or undefined if the S3 credentials are not set in the environment variables or if there is an error creating the client
 */
export const createS3Client = (s3Client?: S3Client): S3Client | undefined => {
  if (s3Client) {
    return s3Client;
  }
  return getCachedS3Client();
};
