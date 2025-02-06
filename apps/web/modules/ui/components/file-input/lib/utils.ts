"use client";

import { toast } from "react-hot-toast";
import { TAllowedFileExtension } from "@formbricks/types/common";
import { convertHeicToJpeg } from "./action";

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
    if (extension === "heic") {
      try {
        const convertedFile = await convertHeicToJpeg(file);
        if (convertedFile) {
          const convertedFileSizeInMB = convertedFile.size / 1000000;
          if (maxSizeInMB && convertedFileSizeInMB > maxSizeInMB) {
            sizeExceedFiles.push(file.name);
            continue;
          }
          convertedFiles.push(
            new File([convertedFile], file.name.replace(/\.heic$/i, ".jpg"), {
              type: "image/jpeg",
            })
          );
        }
        continue;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        toast.error(`Failed to convert ${file.name}: ${errorMessage}`);
        unsupportedExtensionFiles.push(file.name);
        continue;
      }
    }

    if (!allowedFileExtensions.includes(extension as TAllowedFileExtension)) {
      unsupportedExtensionFiles.push(file.name);
      continue;
    } else if (maxSizeInMB && fileSizeInMB > maxSizeInMB) {
      sizeExceedFiles.push(file.name);
      continue;
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
