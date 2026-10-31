/**
 * Client-safe helpers for showing a Signature answer to the survey owner.
 *
 * A Signature answer is one storage URL string (ADR 0016) that the owner's browser loads with the session
 * cookie. Whatever sits in the answer is respondent-written data, so nothing becomes an `href` or `src`
 * until it reads as a private storage path of this app. `parseStorageFileUrl` does that on the server but
 * lives in a `server-only` module, so the check is repeated here in the narrower form the owner UI needs.
 */
import { getOriginalFileNameFromUrl } from "./url-helpers";

/** `/storage/{workspaceId}/private/{file...}`: signatures are always private uploads. */
const PRIVATE_STORAGE_PATH = /^\/storage\/[^/]+\/private\/[^?#]+/;

const DOT_SEGMENT = /^(\.|%2e){1,2}$/i;

const FALLBACK_FILE_NAME = "signature.png";

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
  const url = URL.parse(value);
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:") || url.origin !== currentOrigin) {
    return null;
  }
  const path = `${url.pathname}${url.search}`;
  return isPrivateStoragePath(path) ? path : null;
};

/** The name a downloaded signature gets: the original `signature.png`, never the storage id. */
export const getSignatureDownloadFileName = (src: string): string =>
  getOriginalFileNameFromUrl(src) || FALLBACK_FILE_NAME;

/** What to render for a Signature answer: nothing signed, the image, or the raw text when it is no image. */
export const getSignatureResponseView = (value: unknown, currentOrigin?: string): TSignatureResponseView => {
  if (value === undefined || value === null || value === "") return { kind: "skipped" };

  const src = getSignatureImageSrc(value, currentOrigin);
  if (src) return { kind: "image", src, fileName: getSignatureDownloadFileName(src) };

  return { kind: "text", text: String(value) };
};
