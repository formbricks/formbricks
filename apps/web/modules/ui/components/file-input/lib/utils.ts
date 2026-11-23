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

type TFileCheck = { file: File } | { rejected: "size" | "unsupported" };

/** The file to upload (a HEIC converted to JPEG), or why it is rejected. */
const checkFile = async (
  file: File,
  allowedFileExtensions: string[],
  maxSizeInMB?: number
): Promise<TFileCheck> => {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const fileSizeInMB = file.size / 1000000;

  if (!allowedFileExtensions.includes(extension as TAllowedFileExtension)) {
    return { rejected: "unsupported" };
  }

  if (isFileSizeExceed(fileSizeInMB, maxSizeInMB)) {
    return { rejected: "size" };
  }

  if (extension !== "heic") {
    return { file };
  }

  let convertedFile: File;
  try {
    convertedFile = await convertHeicToJpeg(file);
  } catch {
    return { rejected: "unsupported" };
  }

  if (isFileSizeExceed(convertedFile.size / 1000000, maxSizeInMB)) {
    return { rejected: "size" };
  }

  return { file: convertedFile };
};

/** The toast text for the rejected files, empty when none were rejected. */
const getRejectionMessage = (
  sizeExceedCount: number,
  unsupportedCount: number,
  maxSizeInMB?: number
): string => {
  let toastMessage = "";
  if (sizeExceedCount > 0) {
    if (sizeExceedCount === 1) {
      toastMessage += `File exceeds ${maxSizeInMB} MB size limit.`;
    } else {
      toastMessage += `${sizeExceedCount} files exceed ${maxSizeInMB} MB size limit.`;
    }
  }
  if (unsupportedCount > 0) {
    if (toastMessage) {
      toastMessage += " ";
    }
    if (unsupportedCount === 1) {
      toastMessage += `Unsupported file type.`;
    } else {
      toastMessage += `${unsupportedCount} files have unsupported types.`;
    }
  }
  return toastMessage;
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

    const result = await checkFile(file, allowedFileExtensions, maxSizeInMB);
    if ("file" in result) {
      convertedFiles.push(result.file);
    } else if (result.rejected === "size") {
      sizeExceedFiles.push(file.name);
    } else {
      unsupportedExtensionFiles.push(file.name);
    }
  }

  const toastMessage = getRejectionMessage(
    sizeExceedFiles.length,
    unsupportedExtensionFiles.length,
    maxSizeInMB
  );
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
