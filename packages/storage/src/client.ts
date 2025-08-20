import { S3Client } from "@aws-sdk/client-s3";

const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const S3_REGION = process.env.S3_REGION;
const S3_ENDPOINT_URL = process.env.S3_ENDPOINT_URL;
const S3_FORCE_PATH_STYLE = process.env.S3_FORCE_PATH_STYLE;

export const createS3ClientFromEnv = (): S3Client => {
  const credentials =
    S3_ACCESS_KEY && S3_SECRET_KEY
      ? { accessKeyId: S3_ACCESS_KEY, secretAccessKey: S3_SECRET_KEY }
      : undefined;

  const s3ClientInstance = new S3Client({
    credentials,
    region: S3_REGION,
    ...(S3_ENDPOINT_URL && { endpoint: S3_ENDPOINT_URL }),
    forcePathStyle: S3_FORCE_PATH_STYLE === "1",
  });

  return s3ClientInstance;
};

export const createS3Client = (s3Client?: S3Client): S3Client => {
  const client = s3Client ?? createS3ClientFromEnv();
  return client;
};
