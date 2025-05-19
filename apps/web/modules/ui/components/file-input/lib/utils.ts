"use client";

import { toast } from "react-hot-toast";
import { TAllowedFileExtension } from "@formbricks/types/common";
import { convertHeicToJpegAction } from "./actions";

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
    console.error("Invalid URL", e);
    return false;
  }
};
