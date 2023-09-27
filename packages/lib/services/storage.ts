import { PutObjectCommand, S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// global variables

const AWS_BUCKET_NAME = process.env.S3_BUCKET_NAME!;
const AWS_REGION = process.env.S3_REGION!;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY!;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_KEY!;

// S3Client Singleton

export const s3Client = new S3Client({
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY!,
  },
  region: AWS_REGION!,
});

export const getFileFromS3 = async (fileKey: string): Promise<TGetFileResponse> => {
  const getObjectCommand = new GetObjectCommand({
    Bucket: AWS_BUCKET_NAME,
    Key: fileKey,
  });

  try {
    const data = await s3Client.send(getObjectCommand);

    const imageBuffer = await new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = [];

      // @ts-expect-error
      data.Body.on("data", (chunk: Uint8Array) => {
        chunks.push(chunk);
      });

      // @ts-expect-error
      data.Body.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      // @ts-expect-error
      data.Body.on("error", reject);
    });

    return {
      fileBuffer: imageBuffer as Buffer,
      metaData: {
        contentType: data.ContentType ?? "",
      },
    };
  } catch (err) {
    throw err;
  }
};

export const getSignedUrlForUpload = async (fileKey: string, fileType: string): Promise<string> => {
  const command = new PutObjectCommand({
    Bucket: AWS_BUCKET_NAME,
    Key: fileKey,
    ContentType: fileType,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: 3600,
  });

  return url;
};

type TGetFileResponse = {
  fileBuffer: Buffer;
  metaData: {
    contentType: string;
  };
};
