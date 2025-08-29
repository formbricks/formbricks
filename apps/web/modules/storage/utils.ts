import { logger } from "@formbricks/logger";
import { TResponseData } from "@formbricks/types/responses";
import { TAllowedFileExtension, ZAllowedFileExtension, mimeTypes } from "@formbricks/types/storage";
import { TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

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

/**
 * Validates if the file extension is allowed
 * @param fileName The name of the file to validate
 * @returns {boolean} True if the file extension is allowed, false otherwise
 */
export const isAllowedFileExtension = (fileName: string): boolean => {
  // Extract the file extension
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension || extension === fileName.toLowerCase()) return false;

  // Check if the extension is in the allowed list
  return Object.values(ZAllowedFileExtension.enum).includes(extension as TAllowedFileExtension);
};

/**
 * Validates if the file type matches the extension
 * @param fileName The name of the file
 * @param mimeType The MIME type of the file
 * @returns {boolean} True if the file type matches the extension, false otherwise
 */
export const isValidFileTypeForExtension = (fileName: string, mimeType: string): boolean => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension || extension === fileName.toLowerCase()) return false;

  // Basic MIME type validation for common file types
  const mimeTypeLower = mimeType.toLowerCase();

  // Check if the MIME type matches the expected type for this extension
  return mimeTypes[extension] === mimeTypeLower;
};

export const validateSingleFile = (
  fileUrl: string,
  allowedFileExtensions?: TAllowedFileExtension[]
): boolean => {
  console.log("validateSingleFile", fileUrl);
  const fileName = getOriginalFileNameFromUrl(fileUrl);
  console.log("fileName", fileName);
  if (!fileName) return false;
  const extension = fileName.split(".").pop();
  console.log("extension", extension);
  if (!extension) return false;
  console.log("allowedFileExtensions", allowedFileExtensions);
  console.log("includes", allowedFileExtensions?.includes(extension as TAllowedFileExtension));
  return !allowedFileExtensions || allowedFileExtensions.includes(extension as TAllowedFileExtension);
};

export const validateFileUploads = (data?: TResponseData, questions?: TSurveyQuestion[]): boolean => {
  if (!data) return true;
  for (const key of Object.keys(data)) {
    const question = questions?.find((q) => q.id === key);
    if (!question || question.type !== TSurveyQuestionTypeEnum.FileUpload) continue;

    const fileUrls = data[key];

    if (!Array.isArray(fileUrls) || !fileUrls.every((url) => typeof url === "string")) return false;

    for (const fileUrl of fileUrls) {
      if (!validateSingleFile(fileUrl, question.allowedFileExtensions)) return false;
    }
  }

  return true;
};

export const isValidImageFile = (fileUrl: string): boolean => {
  const fileName = getOriginalFileNameFromUrl(fileUrl);
  if (!fileName || fileName.endsWith(".")) return false;

  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) return false;

  const imageExtensions = ["png", "jpeg", "jpg", "webp", "heic"];
  return imageExtensions.includes(extension);
};
