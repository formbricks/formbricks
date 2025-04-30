import { getOriginalFileNameFromUrl } from "@/lib/storage/utils";
import { TAllowedFileExtension, ZAllowedFileExtension, mimeTypes } from "@formbricks/types/common";
import { TResponseData } from "@formbricks/types/responses";
import { TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

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

/**
 * Validates a file for security concerns
 * @param fileName The name of the file to validate
 * @param mimeType The MIME type of the file
 * @returns {object} An object with validation result and error message if any
 */
export const validateFile = (fileName: string, mimeType: string): { valid: boolean; error?: string } => {
  // Check for disallowed extensions
  if (!isAllowedFileExtension(fileName)) {
    return { valid: false, error: "File type not allowed for security reasons." };
  }

  // Check if the file type matches the extension
  if (!isValidFileTypeForExtension(fileName, mimeType)) {
    return { valid: false, error: "File type doesn't match the file extension." };
  }

  return { valid: true };
};

const validateSingleFile = (fileUrl: string, allowedFileExtensions?: TAllowedFileExtension[]): boolean => {
  const fileName = getOriginalFileNameFromUrl(fileUrl);
  if (!fileName) return false;
  const extension = fileName.split(".").pop();
  if (!extension) return false;
  return !allowedFileExtensions || allowedFileExtensions.includes(extension as TAllowedFileExtension);
};

export const validateFileUploads = (data: TResponseData, questions?: TSurveyQuestion[]): boolean => {
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
