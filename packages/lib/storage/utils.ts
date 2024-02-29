import {
  AWS_ACCESS_KEY_ID,
  AWS_REGION,
  AWS_SECRET_ACCESS_KEY,
  S3_ACCESS_KEY,
  S3_BUCKET_NAME,
  S3_REGION,
  S3_SECRET_KEY,
} from "../constants";

export const getOriginalFileNameFromUrl = (fileURL: string) => {
  try {
    const fileNameFromURL = fileURL.startsWith("/storage/")
      ? fileURL.split("/").pop()
      : new URL(fileURL).pathname.split("/").pop();

    const fileExt = fileNameFromURL?.split(".").pop() ?? "";
    const originalFileName = fileNameFromURL?.split("--fid--")[0] ?? "";
    const fileId = fileNameFromURL?.split("--fid--")[1] ?? "";

    if (!fileId) {
      const fileName = originalFileName ? decodeURIComponent(originalFileName || "") : "";
      return fileName;
    }

    const fileName = originalFileName ? decodeURIComponent(`${originalFileName}.${fileExt}` || "") : "";
    return fileName;
  } catch (error) {
    console.error("Error parsing file URL:", error);
  }
};

export const isS3Configured = () => {
  // for aws sdk, it can pick up the creds for access key, secret key and the region from the environment variables
  if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && AWS_REGION) {
    // so we only need to check if the bucket name is set
    return !!S3_BUCKET_NAME;
  }

  // for other s3 compatible services, we need to provide the access key and secret key
  return S3_ACCESS_KEY && S3_SECRET_KEY && S3_REGION && S3_BUCKET_NAME ? true : false;
};
