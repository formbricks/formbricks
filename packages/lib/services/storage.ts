import { PutObjectCommand, S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { access, mkdir, writeFile, readFile } from "fs/promises";
import mime from "mime";

// global variables

const AWS_BUCKET_NAME = process.env.S3_BUCKET_NAME!;
const AWS_REGION = process.env.S3_REGION!;
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY!;
const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY!;

// S3Client Singleton

const s3Client = new S3Client({
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY!,
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

export const getFileFromS3 = async (fileKey: string): Promise<TGetFileResponse> => {
  const getObjectCommand = new GetObjectCommand({
    Bucket: AWS_BUCKET_NAME,
    Key: fileKey,
  });

  try {
    const data = await s3Client.send(getObjectCommand);
    const byteArray = await data.Body?.transformToByteArray();
    const buffer = Buffer.from(byteArray as Uint8Array);

    return {
      fileBuffer: buffer,
      metaData: {
        contentType: data.ContentType ?? "",
      },
    };
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

// Not used anymore - not removing for now
// export const getSignedUrlForUpload = async (fileKey: string, fileType: string): Promise<string> => {
//   const command = new PutObjectCommand({
//     Bucket: AWS_BUCKET_NAME,
//     Key: fileKey,
//     ContentType: fileType,
//   });

//   const url = await getSignedUrl(s3Client, command, {
//     expiresIn: 3600,
//   });

//   return url;
// };

export const putFileToS3 = async (
  fileName: string,
  fileType: string,
  fileBuffer: Buffer,
  accessType: string,
  environmentId: string
) => {
  try {
    const buffer = Buffer.from(fileBuffer);

    //check the size of buffer and if it is greater than 10MB, return error

    const bufferBytes = buffer.byteLength;
    const bufferKB = bufferBytes / 1024;

    if (bufferKB > 10240) {
      const err = new Error("File size is greater than 1MB");
      err.name = "FileTooLargeError";

      throw err;
    }

    const putObjectCommand = new PutObjectCommand({
      Bucket: AWS_BUCKET_NAME,
      Key: `${environmentId}/${accessType}/${fileName}`,
      Body: buffer,
      ContentType: fileType,
    });

    await s3Client.send(putObjectCommand);
  } catch (err) {
    throw err;
  }
};

export const putFileToLocalStorage = async (
  fileName: string,
  fileBuffer: Buffer,
  accessType: string,
  environmentId: string,
  rootDir: string
) => {
  try {
    await ensureDirectoryExists(`${rootDir}/${environmentId}/${accessType}`);

    const uploadPath = `${rootDir}/${environmentId}/${accessType}/${fileName}`;

    const buffer = Buffer.from(fileBuffer);

    //check the size of buffer and if it is greater than 10MB, return error

    const bufferBytes = buffer.byteLength;
    const bufferKB = bufferBytes / 1024;

    if (bufferKB > 10240) {
      const err = new Error("File size is greater than 1MB");
      err.name = "FileTooLargeError";

      throw err;
    }

    await writeFile(uploadPath, buffer);
  } catch (err) {
    throw err;
  }
};
