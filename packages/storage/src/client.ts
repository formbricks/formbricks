import { S3Client } from "@aws-sdk/client-s3";
import { S3_ACCESS_KEY, S3_ENDPOINT_URL, S3_FORCE_PATH_STYLE, S3_REGION, S3_SECRET_KEY } from "./constants";

/**
 * Create an S3 client from environment variables
 * @returns An S3 client
 * @throws An error if the S3 credentials are not set
 */
export const createS3ClientFromEnv = (): S3Client => {
  const credentials =
    S3_ACCESS_KEY && S3_SECRET_KEY
      ? { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY }
      : undefined;

  if (!credentials) {
    throw new Error("S3 credentials are not set");
  }

  const s3ClientInstance = new S3Client({
    credentials,
    region: S3_REGION,
    ...(S3_ENDPOINT_URL && { endpoint: S3_ENDPOINT_URL }),
    forcePathStyle: S3_FORCE_PATH_STYLE,
  });

  return s3ClientInstance;
};

/**
 * Create an S3 client from an existing client or from environment variables
 * @param s3Client - An existing S3 client
 * @returns An S3 client
 */
export const createS3Client = (s3Client?: S3Client): S3Client => {
  const client = s3Client ?? createS3ClientFromEnv();
  return client;
};
