import { logger } from "@formbricks/logger";

export const getOriginalFileNameFromUrl = (fileURL: string) => {
  try {
    const fileNameFromURL = fileURL.startsWith("/storage/")
      ? fileURL.split("/").pop()
      : new URL(fileURL).pathname.split("/").pop();

    if (!fileNameFromURL) return "";

    const parts = fileNameFromURL.split("--fid--");
    const originalFileName = parts[0];

    if (!originalFileName) return "";

    return decodeURIComponent(originalFileName);
  } catch (error) {
    logger.error(error, "Error parsing file URL");
  }
};

export const getFileNameWithIdFromUrl = (fileURL: string) => {
  try {
    const fileNameFromURL = fileURL.startsWith("/storage/")
      ? fileURL.split("/").pop()
      : new URL(fileURL).pathname.split("/").pop();

    return fileNameFromURL ? decodeURIComponent(fileNameFromURL || "") : "";
  } catch (error) {
    logger.error(error, "Error parsing file URL");
  }
};
