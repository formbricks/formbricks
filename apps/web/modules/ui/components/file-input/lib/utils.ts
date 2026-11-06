"use client";

import { toast } from "react-hot-toast";
import { TAllowedFileExtension } from "@formbricks/types/storage";
import { convertHeicToJpeg } from "./api-client";

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
    if (!file) {
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
      let convertedFile: File;
      try {
        convertedFile = await convertHeicToJpeg(file);
      } catch {
        unsupportedExtensionFiles.push(file.name);
        continue;
      }

      if (isFileSizeExceed(convertedFile.size / 1000000, maxSizeInMB)) {
        sizeExceedFiles.push(file.name);
        continue;
      }

      convertedFiles.push(convertedFile);
      continue;
    }

    convertedFiles.push(file);
  }

  let toastMessage = "";
  if (sizeExceedFiles.length > 0) {
    if (sizeExceedFiles.length === 1) {
      toastMessage += `File exceeds ${maxSizeInMB} MB size limit.`;
    } else {
      toastMessage += `${sizeExceedFiles.length} files exceed ${maxSizeInMB} MB size limit.`;
    }
  }
  if (unsupportedExtensionFiles.length > 0) {
    if (toastMessage) {
      toastMessage += " ";
    }
    if (unsupportedExtensionFiles.length === 1) {
      toastMessage += `Unsupported file type.`;
    } else {
      toastMessage += `${unsupportedExtensionFiles.length} files have unsupported types.`;
    }
  }
  if (toastMessage) {
    toast.error(toastMessage);
  }
  return convertedFiles;
};

export const checkForYoutubePrivacyMode = (url: string): boolean => {
  if (!url || typeof url !== "string" || url.trim() === "") {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.host === "www.youtube-nocookie.com";
  } catch (e) {
    console.error("Invalid URL", e);
    return false;
  }
};
