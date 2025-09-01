import { responses } from "@/app/lib/api/response";
import { logger } from "@formbricks/logger";
import { StorageError, StorageErrorCode } from "@formbricks/storage";
import { TResponseData } from "@formbricks/types/responses";
import { TAllowedFileExtension, ZAllowedFileExtension, mimeTypes } from "@formbricks/types/storage";
import { TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

export const getOriginalFileNameFromUrl = (fileURL: string) => {
  try {
    const lastSegment = fileURL.startsWith("/storage/")
      ? fileURL
      : (new URL(fileURL).pathname.split("/").pop() ?? "");
    const fileNameFromURL = lastSegment.split(/[?#]/)[0];

    const [namePart, fidPart] = fileNameFromURL.split("--fid--");
    if (!fidPart) return namePart ? decodeURIComponent(namePart) : "";

    const dotIdx = fileNameFromURL.lastIndexOf(".");
    const hasExt = dotIdx > fileNameFromURL.indexOf("--fid--");
    const ext = hasExt ? fileNameFromURL.slice(dotIdx + 1) : "";

    return decodeURIComponent(ext ? `${namePart}.${ext}` : namePart);
  } catch (error) {
    logger.error({ error, fileURL }, "Error parsing file URL");
    return "";
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
  const fileName = getOriginalFileNameFromUrl(fileUrl);
  if (!fileName) return false;
  const extension = fileName.split(".").pop();
  if (!extension) return false;
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

export const getErrorResponseFromStorageError = (
  error: StorageError,
  details?: Record<string, string>
): Response => {
  switch (error.code) {
    case StorageErrorCode.FileNotFoundError:
      return responses.notFoundResponse("file", details?.fileName ?? null, true);
    case StorageErrorCode.InvalidInput:
      return responses.badRequestResponse("Invalid input", details, true);
    case StorageErrorCode.S3ClientError:
      return responses.internalServerErrorResponse("Internal server error", true);
    case StorageErrorCode.S3CredentialsError:
      return responses.internalServerErrorResponse("Internal server error", true);
    case StorageErrorCode.Unknown:
      return responses.internalServerErrorResponse("Internal server error", true);
    default: {
      return responses.internalServerErrorResponse("Internal server error", true);
    }
  }
};
