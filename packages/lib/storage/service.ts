import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost, PresignedPostOptions } from "@aws-sdk/s3-presigned-post";
import { access, mkdir, writeFile, readFile, unlink, rmdir } from "fs/promises";
import { join } from "path";
import mime from "mime";
import { env } from "../env.mjs";
import { IS_S3_CONFIGURED, LOCAL_UPLOAD_URL, MAX_SIZES, UPLOADS_DIR, WEBAPP_URL } from "../constants";
import { unstable_cache } from "next/cache";
import { storageCache } from "./cache";
import { TAccessType } from "@formbricks/types/storage";
import { generateLocalSignedUrl } from "../crypto";
import path from "path";

// global variables

const AWS_BUCKET_NAME = env.S3_BUCKET_NAME!;
const AWS_REGION = env.S3_REGION!;
const S3_ACCESS_KEY = env.S3_ACCESS_KEY!;
const S3_SECRET_KEY = env.S3_SECRET_KEY!;

// S3Client Singleton

const s3Client = new S3Client({
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY!,
  },
  region: AWS_REGION!,
});

const ensureDirectoryExists = async (dirPath: string) => {
  try {
    await access(dirPath);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      await mkdir(dirPath, { recursive: true });
    } else {
      throw error;
    }
  }
};

type TGetFileResponse = {
  fileBuffer: Buffer;
  metaData: {
    contentType: string;
  };
};

// discriminated union
type TGetSignedUrlResponse =
  | { signedUrl: string; fileUrl: string; presignedFields: Object }
  | {
      signedUrl: string;
      fileUrl: string;
      signingData: {
        signature: string;
        timestamp: number;
        uuid: string;
      };
    };

export const getS3File = (fileKey: string): Promise<string> => {
  const [_, accessType] = fileKey.split("/");
  const expiresIn = accessType === "public" ? 60 * 60 : 10 * 60;

  const revalidateAfter = accessType === "public" ? expiresIn - 60 * 5 : expiresIn - 60 * 2;

  return unstable_cache(
    async () => {
      const getObjectCommand = new GetObjectCommand({
        Bucket: AWS_BUCKET_NAME,
        Key: fileKey,
      });

      try {
        return await getSignedUrl(s3Client, getObjectCommand, { expiresIn });
      } catch (err) {
        throw err;
      }
    },
    [`getFileFromS3-${fileKey}`],
    {
      revalidate: revalidateAfter,
      tags: [storageCache.tag.byFileKey(fileKey)],
    }
  )();
};

export const getLocalFile = async (filePath: string): Promise<TGetFileResponse> => {
  try {
    const file = await readFile(filePath);
    let contentType = "";

    try {
      contentType = mime.getType(filePath) ?? "";
    } catch (err) {
      throw err;
    }

    return {
      fileBuffer: file,
      metaData: {
        contentType: contentType ?? "",
      },
    };
  } catch (err) {
    throw err;
  }
};

// a single service for generating a signed url based on user's environment variables
export const getUploadSignedUrl = async (
  fileName: string,
  environmentId: string,
  fileType: string,
  accessType: TAccessType,
  plan: "free" | "pro" = "free"
): Promise<TGetSignedUrlResponse> => {
  // handle the local storage case first
  if (!IS_S3_CONFIGURED) {
    try {
      const { signature, timestamp, uuid } = generateLocalSignedUrl(fileName, environmentId, fileType);

      return {
        signedUrl: LOCAL_UPLOAD_URL[accessType],
        signingData: {
          signature,
          timestamp,
          uuid,
        },
        fileUrl: new URL(`${WEBAPP_URL}/storage/${environmentId}/${accessType}/${fileName}`).href,
      };
    } catch (err) {
      throw err;
    }
  }

  try {
    const { presignedFields, signedUrl } = await getS3UploadSignedUrl(
      fileName,
      fileType,
      accessType,
      environmentId,
      accessType === "public",
      plan
    );

    return {
      signedUrl,
      presignedFields,
      fileUrl: new URL(`${WEBAPP_URL}/storage/${environmentId}/${accessType}/${fileName}`).href,
    };
  } catch (err) {
    throw err;
  }
};

export const getS3UploadSignedUrl = async (
  fileName: string,
  contentType: string,
  accessType: string,
  environmentId: string,
  isPublic: boolean,
  plan: "free" | "pro" = "free"
) => {
  const maxSize = isPublic ? MAX_SIZES.public : MAX_SIZES[plan];
  const postConditions: PresignedPostOptions["Conditions"] = [["content-length-range", 0, maxSize]];

  try {
    const { fields, url } = await createPresignedPost(s3Client, {
      Expires: 10 * 60, // 10 minutes
      Bucket: AWS_BUCKET_NAME,
      Key: `${environmentId}/${accessType}/${fileName}`,
      Fields: {
        "Content-Type": contentType,
      },
      Conditions: postConditions,
    });

    return {
      signedUrl: url,
      presignedFields: fields,
    };
  } catch (err) {
    throw err;
  }
};

export const putFileToLocalStorage = async (
  fileName: string,
  fileBuffer: Buffer,
  accessType: string,
  environmentId: string,
  rootDir: string,
  isPublic: boolean = false,
  plan: "free" | "pro" = "free"
) => {
  try {
    await ensureDirectoryExists(`${rootDir}/${environmentId}/${accessType}`);

    const uploadPath = `${rootDir}/${environmentId}/${accessType}/${fileName}`;

    const buffer = Buffer.from(fileBuffer);
    const bufferBytes = buffer.byteLength;

    const maxSize = isPublic ? MAX_SIZES.public : MAX_SIZES[plan];

    if (bufferBytes > maxSize) {
      const err = new Error(`File size exceeds the ${maxSize / (1024 * 1024)} MB limit`);
      err.name = "FileTooLargeError";

      throw err;
    }

    await writeFile(uploadPath, buffer);
  } catch (err) {
    throw err;
  }
};

export const deleteFile = async (environmentId: string, accessType: TAccessType, fileName: string) => {
  if (!IS_S3_CONFIGURED) {
    try {
      await deleteLocalFile(path.join(UPLOADS_DIR, environmentId, accessType, fileName));
      return { success: true, message: "File deleted" };
    } catch (err: any) {
      if (err.code !== "ENOENT") {
        return { success: false, message: err.message ?? "Something went wrong" };
      }

      return { success: false, message: "File not found", code: 404 };
    }
  }

  try {
    await deleteS3File(`${environmentId}/${accessType}/${fileName}`);
    return { success: true, message: "File deleted" };
  } catch (err: any) {
    if (err.name === "NoSuchKey") {
      return { success: false, message: "File not found", code: 404 };
    } else {
      return { success: false, message: err.message ?? "Something went wrong" };
    }
  }
};

export const deleteLocalFile = async (filePath: string) => {
  try {
    await unlink(filePath);
  } catch (err: any) {
    throw err;
  }
};

export const deleteS3File = async (fileKey: string) => {
  const deleteObjectCommand = new DeleteObjectCommand({
    Bucket: AWS_BUCKET_NAME,
    Key: fileKey,
  });

  try {
    await s3Client.send(deleteObjectCommand);
  } catch (err) {
    throw err;
  }
};

export const deleteS3FilesByEnvironmentId = async (environmentId: string) => {
  try {
    // List all objects in the bucket with the prefix of environmentId
    const listObjectsOutput = await s3Client.send(
      new ListObjectsCommand({
        Bucket: AWS_BUCKET_NAME,
        Prefix: environmentId,
      })
    );

    if (listObjectsOutput.Contents) {
      const objectsToDelete = listObjectsOutput.Contents.map((obj) => {
        return { Key: obj.Key };
      });

      if (!objectsToDelete.length) {
        // no objects to delete
        return null;
      }

      // Delete the objects
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: AWS_BUCKET_NAME,
          Delete: {
            Objects: objectsToDelete,
          },
        })
      );
    } else {
      // no objects to delete
      return null;
    }
  } catch (err) {
    throw err;
  }
};

export const deleteLocalFilesByEnvironmentId = async (environmentId: string) => {
  const dirPath = join(UPLOADS_DIR, environmentId);

  try {
    await ensureDirectoryExists(dirPath);
    await rmdir(dirPath, { recursive: true });
  } catch (err) {
    throw err;
  }
};
