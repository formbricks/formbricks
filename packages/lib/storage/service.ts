import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost, PresignedPostOptions } from "@aws-sdk/s3-presigned-post";
import { access, mkdir, writeFile, readFile } from "fs/promises";
import mime from "mime";
import { env } from "@/env.mjs";
import { MAX_SIZES } from "../constants";

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

export const getFileFromS3 = async (fileKey: string) => {
  const getObjectCommand = new GetObjectCommand({
    Bucket: AWS_BUCKET_NAME,
    Key: fileKey,
  });

  try {
    const signedUrl = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 });

    return signedUrl;
  } catch (err) {
    throw err;
  }
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
