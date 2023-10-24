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
import { env } from "@/env.mjs";
import { MAX_SIZES, UPLOADS_DIR } from "../constants";
import { unstable_cache } from "next/cache";
import { storageCache } from "./cache";
import { TAccessType } from "@formbricks/types/storage";

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

export const getFileFromS3 = (fileKey: string): Promise<string> => {
  const [environmentId, accessType] = fileKey.split("/");
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
      tags: [
        storageCache.tag.byEnvironmentId(environmentId),
        storageCache.tag.byAccessType(accessType as TAccessType),
      ],
    }
  )();
};

export const getFileFromLocalStorage = async (filePath: string): Promise<TGetFileResponse> => {
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

export const getSignedUrlForS3Upload = async (
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
    // @ts-ignore
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

export const deleteFileFromLocalStorage = async (filePath: string) => {
  try {
    await unlink(filePath);
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      throw err;
    }
  }
};

export const deleteFileFromS3 = async (fileKey: string) => {
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

export const deleteS3FilesWithEnvironmentId = async (environmentId: string) => {
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

export const deleteLocalFilesWithEnvironmentId = async (environmentId: string) => {
  const dirPath = join(UPLOADS_DIR, environmentId);

  try {
    await ensureDirectoryExists(dirPath);
    await rmdir(dirPath, { recursive: true });
  } catch (err) {
    throw err;
  }
};
