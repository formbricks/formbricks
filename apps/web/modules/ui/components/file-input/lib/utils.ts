"use client";

import { toast } from "react-hot-toast";
import { TAllowedFileExtension } from "@formbricks/types/common";
import { convertHeicToJpegAction } from "./actions";

export const uploadFile = async (
  file: File | Blob,
  allowedFileExtensions: string[] | undefined,
  environmentId: string | undefined
) => {
  try {
    if (!(file instanceof Blob) || !(file instanceof File)) {
      throw new Error(`Invalid file type. Expected Blob or File, but received ${typeof file}`);
    }

    const fileBuffer = await file.arrayBuffer();

    const bufferBytes = fileBuffer.byteLength;
    const bufferKB = bufferBytes / 1024;

    if (bufferKB > 10240) {
      const err = new Error("File size is greater than 10MB");
      err.name = "FileTooLargeError";

      throw err;
    }

    const payload = {
      fileName: file.name,
      fileType: file.type,
      allowedFileExtensions: allowedFileExtensions,
      environmentId: environmentId,
    };

    const response = await fetch("/api/v1/management/storage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }

    const json = await response.json();

    const { data } = json;
    const { signedUrl, fileUrl, signingData, presignedFields, updatedFileName } = data;

    let requestHeaders: Record<string, string> = {};

    if (signingData) {
      const { signature, timestamp, uuid } = signingData;

      requestHeaders = {
        "X-File-Type": file.type,
        "X-File-Name": encodeURIComponent(updatedFileName),
        "X-Environment-ID": environmentId ?? "",
        "X-Signature": signature,
        "X-Timestamp": String(timestamp),
        "X-UUID": uuid,
      };
    }

    const formData = new FormData();

    if (presignedFields) {
      Object.keys(presignedFields).forEach((key) => {
        formData.append(key, presignedFields[key]);
      });
    }

    formData.append("file", file);

    const uploadResponse = await fetch(signedUrl, {
      method: "POST",
      ...(signingData ? { headers: requestHeaders } : {}),
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed with status: ${uploadResponse.status}`);
    }

    return {
      uploaded: true,
      url: fileUrl,
    };
  } catch (error) {
    throw error;
  }
};

const isFileSizeExceed = (fileSizeInMB: number, maxSizeInMB?: number) => {
  if (maxSizeInMB && fileSizeInMB > maxSizeInMB) {
    return true;
  }
  return false;
};

export const getAllowedFiles = async (
  files: File[],
  allowedFileExtensions: string[],
  maxSizeInMB?: number
): Promise<File[]> => {
  const sizeExceedFiles: string[] = [];
  const unsupportedExtensionFiles: string[] = [];
  const convertedFiles: File[] = [];

  for (const file of files) {
    if (!file || !file.type) {
      continue;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    const fileSizeInMB = file.size / 1000000;

    if (!allowedFileExtensions.includes(extension as TAllowedFileExtension)) {
      unsupportedExtensionFiles.push(file.name);
      continue;
    }

    if (isFileSizeExceed(fileSizeInMB, maxSizeInMB)) {
      sizeExceedFiles.push(file.name);
      continue;
    }

    if (extension === "heic") {
      const convertedFileResponse = await convertHeicToJpegAction({ file });
      if (!convertedFileResponse?.data) {
        unsupportedExtensionFiles.push(file.name);
        continue;
      } else {
        const convertedFileSizeInMB = convertedFileResponse.data.size / 1000000;
        if (isFileSizeExceed(convertedFileSizeInMB, maxSizeInMB)) {
          sizeExceedFiles.push(file.name);
          continue;
        }

        const convertedFile = new File([convertedFileResponse.data], file.name.replace(/\.heic$/, ".jpg"), {
          type: "image/jpeg",
        });
        convertedFiles.push(convertedFile);
        continue;
      }
    }

    convertedFiles.push(file);
  }

  let toastMessage = "";
  if (sizeExceedFiles.length > 0) {
    toastMessage += `Files exceeding size limit (${maxSizeInMB} MB): ${sizeExceedFiles.join(", ")}. `;
  }
  if (unsupportedExtensionFiles.length > 0) {
    toastMessage += `Unsupported file types: ${unsupportedExtensionFiles.join(", ")}.`;
  }
  if (toastMessage) {
    toast.error(toastMessage);
  }
  return convertedFiles;
};

export const checkForYoutubePrivacyMode = (url: string): boolean => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.host === "www.youtube-nocookie.com";
  } catch (e) {
    return false;
  }
};
