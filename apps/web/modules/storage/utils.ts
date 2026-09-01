import "server-only";
import { type StorageError, StorageErrorCode } from "@formbricks/storage";
import { TResponseData } from "@formbricks/types/responses";
import {
  IMAGE_FILE_EXTENSIONS,
  type TAccessType,
  type TAllowedFileExtension,
  ZAllowedFileExtension,
} from "@formbricks/types/storage";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyQuestion } from "@formbricks/types/surveys/types";
import { responses } from "@/app/lib/api/response";
import { WEBAPP_URL } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { getSurveyFileUploadConfigs } from "./survey-file-upload-elements";
import { getOriginalFileNameFromUrl } from "./url-helpers";

// Re-exports for backward compatibility with server-side code
export { getOriginalFileNameFromUrl } from "./url-helpers";
export { getSurveyFileUploadConfigs } from "./survey-file-upload-elements";

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
 * Extracts the lowercase file extension from a file name
 * @param fileName The name of the file
 * @returns {string | null} The lowercase extension, or null when no extension exists
 */
const extractFileExtension = (fileName: string): string | null => {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (!extension || extension === fileName.toLowerCase()) return null;

  return extension;
};

/**
 * Validates if the file extension is allowed
 * @param fileName The name of the file to validate
 * @returns {boolean} True if the file extension is allowed, false otherwise
 */
export const isAllowedFileExtension = (fileName: string): boolean => {
  const extension = extractFileExtension(fileName);
  if (!extension) return false;

  // Check if the extension is in the allowed list
  return Object.values(ZAllowedFileExtension.enum).includes(extension as TAllowedFileExtension);
};

export const validateSingleFile = (
  fileUrl: string,
  allowedFileExtensions?: TAllowedFileExtension[]
): boolean => {
  const fileName = getOriginalFileNameFromUrl(fileUrl);
  if (!fileName) return false;
  const extension = extractFileExtension(fileName);
  if (!extension) return false;
  return !allowedFileExtensions || allowedFileExtensions.includes(extension as TAllowedFileExtension);
};

export type TSurveyFileUploadPermissionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: "no_file_upload_element" | "file_upload_element_not_found" | "file_extension_not_allowed";
    };

const getAllowedFileExtensionFromFileName = (fileName: string): TAllowedFileExtension | null => {
  const extension = extractFileExtension(fileName);
  if (!extension) return null;

  const extensionValidation = ZAllowedFileExtension.safeParse(extension);

  return extensionValidation.success ? extensionValidation.data : null;
};

export const validateSurveyAllowsFileUpload = ({
  fileName,
  elementId,
  blocks,
  questions,
}: {
  fileName: string;
  elementId: string;
  blocks?: TSurveyBlock[] | null;
  questions?: TSurveyQuestion[] | null;
}): TSurveyFileUploadPermissionResult => {
  const fileUploadConfigs = getSurveyFileUploadConfigs({ blocks, questions });

  if (fileUploadConfigs.length === 0) {
    return {
      ok: false,
      reason: "no_file_upload_element",
    };
  }

  const fileUploadConfig = fileUploadConfigs.find((config) => config.id === elementId);

  if (!fileUploadConfig) {
    return {
      ok: false,
      reason: "file_upload_element_not_found",
    };
  }

  const fileExtension = getAllowedFileExtensionFromFileName(fileName);

  if (!fileExtension) {
    return {
      ok: false,
      reason: "file_extension_not_allowed",
    };
  }

  const { allowedFileExtensions } = fileUploadConfig;
  const isFileExtensionAllowed =
    allowedFileExtensions === undefined || allowedFileExtensions.includes(fileExtension);

  return isFileExtensionAllowed
    ? { ok: true }
    : {
        ok: false,
        reason: "file_extension_not_allowed",
      };
};

// Origins that may legitimately prefix an absolute storage URL. A response GET resolves stored
// relative `/storage/...` URLs to absolute ones against these app bases (see resolveStorageUrl), so
// a client that reads a response and re-submits the same file-upload answer sends back an absolute
// URL. Those must still validate — but only for the app's own origins, so a foreign absolute URL
// can never be smuggled past the scope check.
const getAppStorageOrigins = (): string[] => {
  const origins: string[] = [];
  for (const base of [WEBAPP_URL, getPublicDomain()]) {
    if (!base) continue;
    try {
      origins.push(new URL(base).origin);
    } catch {
      // Ignore a misconfigured base URL rather than throwing during validation.
    }
  }
  return origins;
};

const getStorageUrlPathSegments = (fileUrl: string): string[] | null => {
  let pathname: string;

  if (fileUrl.startsWith("/storage/")) {
    pathname = fileUrl;
  } else {
    let parsed: URL;
    try {
      parsed = new URL(fileUrl);
    } catch {
      return null;
    }
    // Absolute URLs are only accepted when they point at one of the app's own origins.
    if (!getAppStorageOrigins().includes(parsed.origin)) return null;
    pathname = parsed.pathname;
  }

  const pathWithoutSearch = pathname.split(/[?#]/)[0];
  if (!pathWithoutSearch.startsWith("/storage/")) return null;
  return pathWithoutSearch.split("/").filter(Boolean);
};

type TParsedStorageFileUrl = {
  storageId: string;
  accessType: TAccessType;
  fileName: string;
};

export const parseStorageFileUrl = (fileUrl: string): TParsedStorageFileUrl | null => {
  let pathname: string;

  try {
    pathname = fileUrl.startsWith("/storage/") ? fileUrl : new URL(fileUrl).pathname;
  } catch {
    return null;
  }

  const pathWithoutSearch = pathname.split(/[?#]/)[0];
  if (!pathWithoutSearch.startsWith("/storage/")) return null;

  const [storageSegment, storageId, accessType, ...fileNameSegments] = pathWithoutSearch
    .split("/")
    .filter(Boolean);
  const fileName = fileNameSegments.join("/");

  if (
    storageSegment !== "storage" ||
    !storageId ||
    !fileName ||
    (accessType !== "private" && accessType !== "public")
  ) {
    return null;
  }

  return { storageId, accessType, fileName };
};

const isScopedPrivateUploadUrl = ({
  fileUrl,
  workspaceId,
  surveyId,
  elementId,
  legacyOwnedStoragePrefixes = [],
}: {
  fileUrl: string;
  workspaceId: string;
  surveyId: string;
  elementId: string;
  // Storage prefixes this workspace owns for pre-#8044 file URLs (its own id and, when set, its
  // Workspace.legacyEnvironmentId). Empty for the client widget, which only ever emits the scoped
  // shape below; passed by the management routes so replayed old responses still validate.
  legacyOwnedStoragePrefixes?: string[];
}): boolean => {
  const segments = getStorageUrlPathSegments(fileUrl);

  if (!segments) return false;

  // Current (post-#8044) fully-scoped shape:
  // /storage/{workspaceId}/private/surveys/{surveyId}/elements/{elementId}/{file}  -> 8 parts
  if (segments.length === 8) {
    const [
      storageSegment,
      storageWorkspaceId,
      accessType,
      surveysSegment,
      storageSurveyId,
      elementsSegment,
      storageElementId,
      fileName,
    ] = segments;

    return (
      storageSegment === "storage" &&
      storageWorkspaceId === workspaceId &&
      accessType === "private" &&
      surveysSegment === "surveys" &&
      storageSurveyId === surveyId &&
      elementsSegment === "elements" &&
      storageElementId === elementId &&
      Boolean(fileName)
    );
  }

  // Legacy shapes uploaded before #8044 (pre-Formbricks-5 environment-id prefix, or the Formbricks-5
  // workspace-id prefix) never recorded a survey or element, so they are only 4 parts:
  // /storage/{prefix}/private/{file}. A read-then-write of such a response (backfills, re-imports,
  // two-way integrations) must still validate — but only when {prefix} is a storage namespace THIS
  // workspace owns, so cross-tenant deletion stays closed (the prefix is the only part that decides
  // whose file a later cleanup deletes). Survey/element binding is unavailable here because the old
  // URL never carried it.
  if (segments.length === 4 && legacyOwnedStoragePrefixes.length > 0) {
    const [storageSegment, storagePrefix, accessType, fileName] = segments;

    return (
      storageSegment === "storage" &&
      accessType === "private" &&
      legacyOwnedStoragePrefixes.includes(storagePrefix) &&
      Boolean(fileName)
    );
  }

  return false;
};

export const validateClientFileUploads = ({
  data,
  workspaceId,
  surveyId,
  blocks,
  questions,
  legacyOwnedStoragePrefixes,
}: {
  data?: TResponseData;
  workspaceId: string;
  surveyId: string;
  blocks?: TSurveyBlock[] | null;
  questions?: TSurveyQuestion[] | null;
  // Passed by the management routes (see getWorkspaceLegacyEnvironmentId) so a replayed old response
  // whose file URL predates the scoped shape still validates against a prefix the workspace owns.
  // Omitted by the client widget path, which stays strict on the scoped shape.
  legacyOwnedStoragePrefixes?: string[];
}): boolean => {
  if (!data) return true;

  const fileUploadConfigs = getSurveyFileUploadConfigs({ blocks, questions });

  for (const fileUploadConfig of fileUploadConfigs) {
    const fileUrls = data[fileUploadConfig.id];

    if (fileUrls === undefined) continue;
    if (!Array.isArray(fileUrls) || !fileUrls.every((url) => typeof url === "string")) return false;

    for (const fileUrl of fileUrls) {
      if (!validateSingleFile(fileUrl, fileUploadConfig.allowedFileExtensions)) return false;
      if (
        !isScopedPrivateUploadUrl({
          fileUrl,
          workspaceId,
          surveyId,
          elementId: fileUploadConfig.id,
          legacyOwnedStoragePrefixes,
        })
      ) {
        return false;
      }
    }
  }

  return true;
};

export const isValidImageFile = (fileUrl: string): boolean => {
  const fileName = getOriginalFileNameFromUrl(fileUrl);
  if (!fileName || fileName.endsWith(".")) return false;

  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension) return false;

  return (IMAGE_FILE_EXTENSIONS as readonly string[]).includes(extension);
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
    case StorageErrorCode.S3CredentialsError:
      return responses.internalServerErrorResponse(
        "File storage is not configured correctly. Please check your file upload settings.",
        true,
        { storage_error_code: error.code },
        "private, no-store"
      );
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
