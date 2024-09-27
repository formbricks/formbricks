"use client";

import { toast } from "react-hot-toast";
import { TAllowedFileExtension } from "@formbricks/types/common";

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

    // check the file size

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

    // Add the actual file to be uploaded
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

export const getAllowedFiles = (
  files: File[],
  allowedFileExtensions: string[],
  maxSizeInMB?: number
): File[] => {
  const sizeExceedFiles: string[] = [];
  const unsupportedExtensionFiles: string[] = [];

  const allowedFiles = files.filter((file) => {
    if (!file || !file.type) {
      return false;
    }

    const extension = file.name.split(".").pop();
    const fileSizeInMB = file.size / 1000000; // Kb -> Mb

    if (!allowedFileExtensions.includes(extension as TAllowedFileExtension)) {
      unsupportedExtensionFiles.push(file.name);
      return false; // Exclude file if extension not allowed
    } else if (maxSizeInMB && fileSizeInMB > maxSizeInMB) {
      sizeExceedFiles.push(file.name);
      return false; // Exclude files larger than the maximum size
    }

    return true;
  });

  // Constructing toast messages based on the issues found
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
  return allowedFiles;
};

export const checkForYoutubePrivacyMode = (url: string): boolean => {
  return url.includes("youtube-nocookie.com");
};
