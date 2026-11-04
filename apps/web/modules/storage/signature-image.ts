/**
 * Client-safe helpers for showing a Signature answer to the survey owner.
 *
 * A Signature answer is one storage URL string (ADR 0023) that the owner's browser loads with the session
 * cookie. Whatever sits in the answer is respondent-written data, so nothing becomes an `href` or `src`
 * until it reads as a private storage path of this app. `parseStorageFileUrl` does that on the server but
 * lives in a `server-only` module, so the check is repeated here in the narrower form the owner UI needs.
 */
import { getOriginalFileNameFromUrl } from "./url-helpers";

/** `/storage/{workspaceId}/private/{file...}`: signatures are always private uploads. */
const PRIVATE_STORAGE_PATH = /^\/storage\/[^/]+\/private\/[^?#]+/;

const DOT_SEGMENT = /^(\.|%2e){1,2}$/i;

const FALLBACK_FILE_NAME = "signature.png";

/** The longest response id kept in a download name; real ids are 25 characters. */
const MAX_FILE_NAME_ID_LENGTH = 64;

/** The browser's origin, or `undefined` while rendering on the server, where an absolute URL cannot be checked. */
export const getClientOrigin = (): string | undefined =>
  typeof window === "undefined" ? undefined : window.location.origin;

export type TSignatureResponseView =
  | { kind: "skipped" }
  | { kind: "image"; src: string; fileName: string }
  | { kind: "text"; text: string };

const isPrivateStoragePath = (path: string): boolean => {
  if (!PRIVATE_STORAGE_PATH.test(path)) return false;
  const pathname = path.split(/[?#]/)[0];
  return !pathname.includes("\\") && !pathname.split("/").some((segment) => DOT_SEGMENT.test(segment));
};

/**
 * The same-origin path to load a Signature answer's image from, or `null` when the value is not a private
 * storage URL of this app. An absolute URL is accepted only on `currentOrigin` (an API client may have
 * written the resolved form) and is returned as its path, so the browser never leaves the app's origin.
 */
export const getSignatureImageSrc = (value: unknown, currentOrigin?: string): string | null => {
  if (typeof value !== "string" || value === "") return null;

  if (value.startsWith("/storage/")) return isPrivateStoragePath(value) ? value : null;

  if (!currentOrigin) return null;
  // `new URL` in a try, not `URL.parse`: the latter needs Safari 18 / Chrome 126 and this runs in the browser.
  let url: URL | null = null;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if ((url.protocol !== "https:" && url.protocol !== "http:") || url.origin !== currentOrigin) {
    return null;
  }
  const path = `${url.pathname}${url.search}`;
  return isPrivateStoragePath(path) ? path : null;
};

/**
 * The name a downloaded signature gets: the original `signature.png`, never the storage id, with the
 * response's id after the name (`signature-{responseId}.png`) so several downloads stay apart and each
 * one traces back to its response. The id is cut down to file-name-safe characters.
 */
export const getSignatureDownloadFileName = (src: string, responseId?: string): string => {
  const originalName = getOriginalFileNameFromUrl(src) || FALLBACK_FILE_NAME;
  const safeId = (responseId ?? "").replaceAll(/[^A-Za-z0-9_-]/g, "").slice(0, MAX_FILE_NAME_ID_LENGTH);
  if (!safeId) return originalName;

  const extensionStart = originalName.lastIndexOf(".");
  if (extensionStart <= 0) return `${originalName}-${safeId}`;
  return `${originalName.slice(0, extensionStart)}-${safeId}${originalName.slice(extensionStart)}`;
};

/** The text shown for a stored value that is no image: a string as it is, anything else in its JSON form. */
const toDisplayText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value) ?? "";
};

/** What to render for a Signature answer: nothing signed, the image, or the raw text when it is no image. */
export const getSignatureResponseView = (
  value: unknown,
  currentOrigin?: string,
  responseId?: string
): TSignatureResponseView => {
  if (value === undefined || value === null || value === "") return { kind: "skipped" };

  const src = getSignatureImageSrc(value, currentOrigin);
  if (src) return { kind: "image", src, fileName: getSignatureDownloadFileName(src, responseId) };

  return { kind: "text", text: toDisplayText(value) };
};
