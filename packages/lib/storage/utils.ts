import { logger } from "@formbricks/logger";

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
    logger.error(error, "Error parsing file URL:");
  }
};

export const getFileNameWithIdFromUrl = (fileURL: string) => {
  try {
    const fileNameFromURL = fileURL.startsWith("/storage/")
      ? fileURL.split("/").pop()
      : new URL(fileURL).pathname.split("/").pop();

    return fileNameFromURL ? decodeURIComponent(fileNameFromURL || "") : "";
  } catch (error) {
    logger.error(error, "Error parsing file URL:");
  }
};
