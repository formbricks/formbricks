import "server-only";
import { logger } from "@formbricks/logger";
import { type StorageError, StorageErrorCode } from "@formbricks/storage";
import { TResponseData } from "@formbricks/types/responses";
import {
  IMAGE_FILE_EXTENSIONS,
  type TAccessType,
  type TAllowedFileExtension,
  ZAllowedFileExtension,
} from "@formbricks/types/storage";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { responses } from "@/app/lib/api/response";
import { WEBAPP_URL } from "@/lib/constants";
import { getPublicDomain } from "@/lib/getPublicUrl";
import {
  type TStringUploadElementKind,
  type TSurveyUploadElementIds,
  type TUploadElementCandidate,
  createEmptyUploadElementIds,
  getSurveyUploadElementConfigs,
  getUploadElementAllowedExtensions,
  mapUploadElementTypes,
  uploadElementKinds,
} from "./survey-upload-elements";
import { getOriginalFileNameFromUrl } from "./url-helpers";

// Re-exports for backward compatibility with server-side code
export { getOriginalFileNameFromUrl } from "./url-helpers";
export { getSurveyUploadElementConfigs } from "./survey-upload-elements";

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
  allowedFileExtensions?: readonly TAllowedFileExtension[]
): boolean => {
  const fileName = getOriginalFileNameFromUrl(fileUrl);
  if (!fileName) return false;
  const extension = extractFileExtension(fileName);
  if (!extension) return false;
  return !allowedFileExtensions || allowedFileExtensions.includes(extension as TAllowedFileExtension);
};

export type TSurveyUploadPermissionResult =
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

/**
 * The ids of the elements whose answers hold storage URLs.
 *
 * Every response-file delete path needs the id sets rather than the configs, and they must come from the
 * union of `blocks` and `questions` — the same source write-time validation reads — because keying off
 * a single shape silently skips deletes for the other.
 *
 * Split from `collectResponseFileUrls` so a caller scanning many responses builds the sets once. Empty
 * sets do not mean there is nothing to collect: a survey-scoped key is collected without them. Only a
 * scan that wants flat keys alone may skip on an empty `fileUpload` set.
 */
export const getSurveyUploadElementIds = (survey: {
  blocks?: TSurveyBlock[] | null;
  questions?: readonly TUploadElementCandidate[] | null;
}): TSurveyUploadElementIds => {
  const configs = getSurveyUploadElementConfigs({ blocks: survey.blocks, questions: survey.questions });

  return mapUploadElementTypes(
    (type) => new Set(configs.filter((config) => config.type === type).map((config) => config.id))
  );
};

/** A percent-encoded `/`, `\` or `.`: the characters a key's segments are split on or stepped out of by. */
const hasEncodedPathSeparator = (value: string): boolean => /%(?:2f|5c|2e)/i.test(value);

/** A literal `.` or `..` path segment, which an absolute URL's parser would silently resolve away. */
const hasDotSegment = (value: string): boolean =>
  value
    .split(/[?#]/)[0]
    .split("/")
    .some((segment) => segment === "." || segment === "..");

/**
 * Whose file one storage URL found in the answer to `elementId` is, when cleaning up `surveyId`.
 *
 * A key filed under a survey (`{id}/private/surveys/{surveyId}/elements/{elementId}/…`, every upload
 * since #8044) names the survey and element it was uploaded for, so the key decides, not whether that
 * element still exists. It is `own` only when both match: the answer it sits under is the element's, and
 * write-time validation (`isScopedPrivateUploadUrl`) only ever stores a key under its own element. So a
 * deleted element's files are still collected, while a same-survey URL pasted into another answer (a
 * multi-select "Other", say) is not.
 *
 * Anything else filed under a survey is `refused`. That covers a same-workspace URL planted under a key
 * that only later became an upload element (the ENG-2291 flip), which passes `deleteResponseFileUrls`'
 * workspace check, so the binding is enforced here. A public key is never a response upload.
 *
 * A flat pre-#8044 key (`{prefix}/private/{file}`) names no survey, so it is trusted only under a current
 * upload element. One left by a deleted element stays in storage: an accepted legacy leak, since every
 * upload since #8044 gets a scoped key.
 */
const getResponseFileUrlOwner = ({
  fileUrl,
  elementId,
  isFileUploadAnswer,
  isBareString,
  surveyId,
}: {
  fileUrl: string;
  elementId: string;
  isFileUploadAnswer: boolean;
  isBareString: boolean;
  surveyId: string;
}): "own" | "refused" | "none" => {
  // `getStorageUrlSurveyId`'s reading, with the URL parsed once: a name that does not decode names no
  // survey.
  const parsed = parseStorageFileUrl(fileUrl);
  const scope = parsed ? getStorageFileNameScope(parsed.fileName) : undefined;

  // The upload route never emits an encoded separator or a dot segment, so a bare string holding one was
  // written by hand to reach a key the plain reading does not name (the delete path decodes the name once
  // more).
  // Arrays are left as they were: older File upload names may hold one.
  if (parsed && isBareString && (hasEncodedPathSeparator(fileUrl) || hasDotSegment(fileUrl))) {
    return "refused";
  }
  if (!parsed || !scope?.decodable || scope.surveyId === null) return isFileUploadAnswer ? "own" : "none";
  if (parsed.accessType !== "private") return "none";
  return scope.surveyId === surveyId && scope.elementId === elementId ? "own" : "refused";
};

/**
 * Pulls the storage URLs one response of `surveyId` owns out of its answers, ready to hand to
 * `deleteResponseFileUrls`. Which URLs count is `getResponseFileUrlOwner`'s rule.
 *
 * File-upload answers are stored as an array of strings, so an array answer is read under any id, and
 * only its string entries. A Signature answer is one string (ADR 0016), and a bare string is read under
 * any id, live or not, of any element type: what makes it a target is its key, not its element. A key
 * filed under this survey and the answer's own element id (`getResponseFileUrlOwner`) can only have been
 * written for that element, which only held an upload while it was a File upload or a Signature, so a
 * deleted element or one retyped to Free text still has its image removed with the response. The same
 * answer holding a pasted URL for another survey or element, a public key or a flat pre-#8044 key is
 * not a target, so a text answer cannot aim a delete at someone else's file.
 *
 * A bare string never owns a flat pre-#8044 key: only File upload arrays have that history, so a flat
 * key counts only inside an array under a current File upload id.
 *
 * URLs refused for naming another survey or element are logged as a count, never the URLs: they are the
 * trace a planted URL leaves.
 *
 * `data` is deliberately `unknown`: callers hand this a raw `Prisma.JsonValue` column or an already
 * typed `TResponseData`, and the shape is checked here either way rather than cast at each call site.
 */
export const collectResponseFileUrls = (
  data: unknown,
  elementIds: TSurveyUploadElementIds,
  surveyId: string
): string[] => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return [];
  }

  const fileUrls: string[] = [];
  let refusedCount = 0;
  // Typed rather than left as `Object.entries`' implicit `any` values, so the guards below are the only
  // thing that narrows an answer to a string.
  const answers: [string, unknown][] = Object.entries(data);

  for (const [elementId, answer] of answers) {
    let answerUrls: unknown[];
    if (Array.isArray(answer)) {
      answerUrls = answer;
    } else if (typeof answer === "string") {
      answerUrls = [answer];
    } else {
      continue;
    }

    const isBareString = typeof answer === "string";
    const isFileUploadAnswer = !isBareString && elementIds.fileUpload.has(elementId);
    for (const fileUrl of answerUrls) {
      if (typeof fileUrl !== "string") continue;

      const owner = getResponseFileUrlOwner({
        fileUrl,
        elementId,
        isFileUploadAnswer,
        isBareString,
        surveyId,
      });
      if (owner === "own") fileUrls.push(fileUrl);
      if (owner === "refused") refusedCount++;
    }
  }

  if (refusedCount > 0) {
    logger.warn({ surveyId, refusedCount }, "Refusing response files filed under another survey or element");
  }

  return fileUrls;
};

/** The key a storage URL names, so a relative and an absolute spelling of one file compare equal. */
const getStorageFileKey = (fileUrl: string): string => {
  const parsed = parseStorageFileUrl(fileUrl);
  return parsed ? `${parsed.storageId}/${parsed.accessType}/${parsed.fileName}` : fileUrl;
};

/**
 * The Signature images a write to a response leaves behind: the old file of each Signature answer the
 * write cleared, removed or replaced by another file (ADR 0016). Clearing a signature is the respondent
 * withdrawing it, and a replaced one is never shown again, so neither image should outlive the answer.
 *
 * `nextData` is what the response holds after the write (the merged data for a merging update, the new
 * data for a replacing one), so an answer the write did not touch compares equal and is kept, as is the
 * same file spelled as a relative and as an absolute URL (a client re-submitting what a read returned).
 * Only Signature ids are read: a File upload's array keeps its behaviour. A URL still has to be filed
 * under this survey and the answer's own element id (`collectResponseFileUrls`), so a write cannot aim a
 * delete at another survey's, another element's or a flat key's file.
 */
export const collectReplacedSignatureFileUrls = ({
  previousData,
  nextData,
  signatureElementIds,
  surveyId,
}: {
  previousData: unknown;
  nextData: unknown;
  signatureElementIds: ReadonlySet<string>;
  surveyId: string;
}): string[] => {
  if (!previousData || typeof previousData !== "object" || Array.isArray(previousData)) return [];
  const next: Record<string, unknown> =
    nextData && typeof nextData === "object" && !Array.isArray(nextData) ? { ...nextData } : {};
  const noUploadElementIds = createEmptyUploadElementIds();

  const fileUrls: string[] = [];
  for (const [elementId, previous] of Object.entries(previousData)) {
    if (!signatureElementIds.has(elementId) || typeof previous !== "string" || previous === "") continue;

    const current = next[elementId];
    if (typeof current === "string" && getStorageFileKey(current) === getStorageFileKey(previous)) continue;

    fileUrls.push(...collectResponseFileUrls({ [elementId]: previous }, noUploadElementIds, surveyId));
  }

  return fileUrls;
};

export const validateSurveyAllowsUpload = ({
  fileName,
  elementId,
  blocks,
  questions,
}: {
  fileName: string;
  elementId: string;
  blocks?: TSurveyBlock[] | null;
  questions?: readonly TUploadElementCandidate[] | null;
}): TSurveyUploadPermissionResult => {
  const uploadElementConfigs = getSurveyUploadElementConfigs({ blocks, questions });

  if (uploadElementConfigs.length === 0) {
    return {
      ok: false,
      reason: "no_file_upload_element",
    };
  }

  const uploadElementConfig = uploadElementConfigs.find((config) => config.id === elementId);

  if (!uploadElementConfig) {
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

  const allowedFileExtensions = getUploadElementAllowedExtensions(uploadElementConfig);
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
  // `URL.parse` returns null instead of throwing. Response-file collection runs this on every string of
  // every array answer, so a throw per non-URL string would add up fast on a row holding thousands.
  const pathname = fileUrl.startsWith("/storage/") ? fileUrl : URL.parse(fileUrl)?.pathname;
  if (!pathname) return null;

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

/**
 * The survey a storage URL's object key is filed under: the `{surveyId}` of a current upload
 * (`{id}/private/surveys/{surveyId}/…`), or `null` for a key that names no survey — the flat
 * pre-#8044 keys, and anything that does not parse.
 *
 * Reads the key the way the delete path builds it. `deleteResponseFileUrls` decodes the file name
 * before deleting, so the check decodes too: on the raw URL, `%73urveys/{other}/…` or
 * `surveys%2F{other}%2F…` would read as a flat key and still delete `surveys/{other}/…`. A name that
 * does not decode returns `null`, because the delete path fails on it the same way and deletes
 * nothing.
 */
export const getStorageUrlSurveyId = (fileUrl: string): string | null => {
  const parsed = parseStorageFileUrl(fileUrl);
  if (!parsed) return null;

  const scope = getStorageFileNameScope(parsed.fileName);
  return scope.decodable ? scope.surveyId : null;
};

/**
 * Which survey (and, for an upload, which element) an object key's file name is filed under, read from
 * the name the storage layer actually uses: `getFileStreamForDownload` and `deleteFile` both decode the
 * joined name once more before building the key, so the check has to decode it too. `decodable: false`
 * for a name that does not decode — the storage layer fails on it as well, so there is no object it
 * could reach.
 *
 * `fileName` is the joined, still-encoded name: a URL path's file part, or the route's catch-all
 * segments joined with `/`.
 */
export const getStorageFileNameScope = (
  fileName: string
):
  | { decodable: false }
  | { decodable: true; isSurveyScope: boolean; surveyId: string | null; elementId: string | null } => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(fileName);
  } catch {
    return { decodable: false };
  }

  const [scope, surveyId, elementsSegment, elementId] = decoded.split("/");
  const isSurveyScope = scope === "surveys" && decoded.includes("/");
  return {
    decodable: true,
    isSurveyScope,
    surveyId: isSurveyScope && surveyId ? surveyId : null,
    elementId: isSurveyScope && elementsSegment === "elements" && elementId ? elementId : null,
  };
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

/**
 * A bare-string answer (a Signature, ADR 0016) is valid when it is a skipped `""` (if the element type
 * allows that) or one URL, filed under this workspace, survey and element, whose file name is the one the
 * upload route gives the type's export (`fileNamePattern`), with no encoded separator or dot anywhere.
 * This checks the URL, not the object: whether the file exists is not read on a public write route.
 * Anything else under such an id (an array, a number, a URL for another element) is refused: the id
 * decides what shape is accepted, and the URL decides whose file it is.
 */
const isValidBareStringAnswer = ({
  answer,
  kind,
  workspaceId,
  surveyId,
  elementId,
}: {
  answer: unknown;
  kind: TStringUploadElementKind;
  workspaceId: string;
  surveyId: string;
  elementId: string;
}): boolean => {
  if (typeof answer !== "string") return false;
  if (answer === "" && kind.emptyStringIsSkipped) return true;
  if (hasEncodedPathSeparator(answer) || hasDotSegment(answer)) return false;
  // No empty path segment (`//`): a store or proxy that merges them would read a different key than the
  // one validated here. A query or hash after the name stays accepted, as in the URL a GET returns.
  if (
    answer
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
      .split(/[?#]/)[0]
      .includes("//")
  )
    return false;

  return (
    validateSingleFile(answer, kind.fixedAllowedExtensions) &&
    isScopedPrivateUploadUrl({ fileUrl: answer, workspaceId, surveyId, elementId }) &&
    // Whatever the key's other segments say, the stored file must carry the name the upload route gives
    // this kind's export, so a hand-made value cannot stand in for a signature.
    kind.fileNamePattern.test(getStorageUrlPathSegments(answer)?.at(-1) ?? "")
  );
};

type TUploadElementConfig = ReturnType<typeof getSurveyUploadElementConfigs>[number];

/** One URL string per element (ADR 0016) or an array of URLs, as the element's kind says. */
const isValidUploadElementAnswer = ({
  answer,
  config,
  workspaceId,
  surveyId,
  legacyOwnedStoragePrefixes,
}: {
  answer: unknown;
  config: TUploadElementConfig;
  workspaceId: string;
  surveyId: string;
  legacyOwnedStoragePrefixes?: string[];
}): boolean => {
  const kind = uploadElementKinds[config.type];

  if (kind.answerShape === "string") {
    // Never a pre-#8044 flat key: no legacy prefixes.
    return isValidBareStringAnswer({ answer, kind, workspaceId, surveyId, elementId: config.id });
  }

  if (!Array.isArray(answer) || !answer.every((url) => typeof url === "string")) return false;

  return answer.every(
    (fileUrl) =>
      validateSingleFile(fileUrl, getUploadElementAllowedExtensions(config)) &&
      isScopedPrivateUploadUrl({
        fileUrl,
        workspaceId,
        surveyId,
        elementId: config.id,
        legacyOwnedStoragePrefixes,
      })
  );
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
  questions?: readonly TUploadElementCandidate[] | null;
  // Passed by the management routes (see getWorkspaceLegacyEnvironmentId) so a replayed old response
  // whose file URL predates the scoped shape still validates against a prefix the workspace owns.
  // Omitted by the client widget path, which stays strict on the scoped shape.
  legacyOwnedStoragePrefixes?: string[];
}): boolean => {
  if (!data) return true;

  return getSurveyUploadElementConfigs({ blocks, questions }).every((config) => {
    const answer = data[config.id];
    if (answer === undefined) return true;
    return isValidUploadElementAnswer({ answer, config, workspaceId, surveyId, legacyOwnedStoragePrefixes });
  });
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
