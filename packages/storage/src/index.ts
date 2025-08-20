import { DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { type PresignedPostOptions, createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client } from "./client";
import { IS_FORMBRICKS_CLOUD, MAX_SIZES, S3_BUCKET_NAME } from "./constants";

const s3Client = createS3Client();

/**
 * Get a signed URL for uploading a file to S3
 * @param fileName - The name of the file to upload
 * @param contentType - The content type of the file
 * @param filePath - The path to the file in S3
 * @param isBiggerFileUploadAllowed - Whether to allow uploading bigger files
 * @returns A signed URL for the file
 */
export const getSignedUploadUrl = async (
  fileName: string,
  contentType: string,
  filePath: string,
  isBiggerFileUploadAllowed = false
): Promise<{
  signedUrl: string;
  presignedFields: PresignedPostOptions["Fields"];
}> => {
  let maxSize = MAX_SIZES.standard;

  if (IS_FORMBRICKS_CLOUD) {
    maxSize = isBiggerFileUploadAllowed ? MAX_SIZES.big : MAX_SIZES.standard;
  } else {
    maxSize = Infinity;
  }

  const postConditions: PresignedPostOptions["Conditions"] = IS_FORMBRICKS_CLOUD
    ? [["content-length-range", 0, maxSize]]
    : undefined;

  const { fields, url } = await createPresignedPost(s3Client, {
    Expires: 10 * 60, // 10 minutes
    Bucket: process.env.S3_BUCKET_NAME ?? "",
    Key: `${filePath}/${fileName}`,
    Fields: {
      "Content-Type": contentType,
      "Content-Encoding": "base64",
    },
    Conditions: postConditions,
  });

  return {
    signedUrl: url,
    presignedFields: fields,
  };
};

/**
 * Get a signed URL for a file in S3
 * @param filePath - The path to the file in S3
 * @returns A signed URL for the file
 */
export const getSignedDownloadUrl = async (filePath: string): Promise<string> => {
  const getObjectCommand = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: filePath,
  });

  return await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 60 * 30 });
};

/**
 * Delete a file from S3
 * @param filePath - The path to the file in S3
 */
export const deleteFile = async (filePath: string): Promise<void> => {
  const deleteObjectCommand = new DeleteObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: filePath,
  });

  await s3Client.send(deleteObjectCommand);
};
