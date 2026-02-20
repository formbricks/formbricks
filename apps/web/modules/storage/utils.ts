import "server-only";
import { StorageError, StorageErrorCode } from "@formbricks/storage";
import { TResponseData } from "@formbricks/types/responses";
import { TAllowedFileExtension, ZAllowedFileExtension, mimeTypes } from "@formbricks/types/storage";
import { TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { responses } from "@/app/lib/api/response";
import { WEBAPP_URL } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getOriginalFileNameFromUrl } from "./url-helpers";

// Re-export for backward compatibility with server-side code
export { getOriginalFileNameFromUrl } from "./url-helpers";

/**
 * Sanitize a provided file name to a safe subset.
 * - Removes path separators and backslashes to avoid implicit prefixes
 * - Drops ASCII control chars and reserved URL chars which often break S3 form fields
 * - Collapses whitespace
 * - Limits length to a reasonable maximum
 * - Preserves last extension only
 */
export const sanitizeFileName = (rawFileName: string): string => {
  if (!rawFileName) return "";

  // Normalize to NFC to avoid weird Unicode composition differences
  let name = rawFileName.normalize("NFC");

  // Replace path separators/backslashes with dash
  name = name.replace(/[\\/]/g, "-");

  // Disallow: # <> : " | ? * ` ' and control whitespace
  name = name.replace(/[#<>:"|?*`']/g, "");

  // Collapse and trim whitespace
  name = name.replace(/\s+/g, " ").trim();

  // Split into base and extension; keep only the last extension
  const parts = name.split(".");
  const hasExt = parts.length > 1;
  const ext = hasExt ? parts.pop()! : "";
  let base = (hasExt ? parts.join(".") : parts[0]).trim();

  // Fallback base if empty after sanitization
  if (!base) return "";
  // Reject bases that are only punctuation like hyphens or dots
  if (/^-+$/.test(base) || /^\.+$/.test(base)) return "";

  // Enforce max lengths (S3 key limit is 1024; be conservative for filename)
  const MAX_BASE = 200;
  const MAX_EXT = 20;
  if (base.length > MAX_BASE) base = base.slice(0, MAX_BASE);
  const safeExt = ext.slice(0, MAX_EXT).replace(/[^A-Za-z0-9]/g, "");

  const result = safeExt ? `${base}.${safeExt}` : base;
  // Final guard: empty or just dots/hyphens shouldn't pass
  if (!result || /^\.*$/.test(result) || /^-+$/.test(result)) return "";
  return result;
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
  const extension = fileName.split(".").pop()?.toLowerCase();
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

/**
 * Resolves a storage URL to an absolute URL.
 * - If already absolute, returns as-is
 * - If relative (/storage/...), prepends the appropriate base URL
 * @param url The storage URL (relative or absolute)
 * @param accessType The access type to determine which base URL to use (defaults to "public")
 * @returns The resolved absolute URL, or empty string if url is falsy
 */
export const resolveStorageUrl = (
  url: string | undefined | null,
  accessType: "public" | "private" = "public"
): string => {
  if (!url) return "";

  // Already absolute URL - return as-is
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Relative path - resolve with base URL
  if (url.startsWith("/storage/")) {
    const baseUrl = accessType === "public" ? getPublicDomain() : WEBAPP_URL;
    return `${baseUrl}${url}`;
  }

  return url;
};

// Matches the actual storage URL format: /storage/{id}/{public|private}/{filename...}
const STORAGE_URL_PATTERN = /^\/storage\/[^/]+\/(public|private)\/.+/;

const isStorageUrl = (value: string): boolean => STORAGE_URL_PATTERN.test(value);

export const resolveStorageUrlAuto = (url: string): string => {
  if (!isStorageUrl(url)) return url;
  const accessType = url.includes("/private/") ? "private" : "public";
  return resolveStorageUrl(url, accessType);
};

/**
 * Recursively walks an object/array and resolves all relative storage URLs
 * Preserves the original structure; skips Date instances and non-object primitives.
 */
export const resolveStorageUrlsInObject = <T>(obj: T): T => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "string") {
    return resolveStorageUrlAuto(obj) as T;
  }

  if (typeof obj !== "object") return obj;

  if (obj instanceof Date) return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveStorageUrlsInObject(item)) as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = resolveStorageUrlsInObject(value);
  }

  return result as T;
};
