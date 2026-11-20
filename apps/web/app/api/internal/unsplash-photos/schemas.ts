import { z } from "zod";
import { UNSPLASH_ALLOWED_DOMAINS } from "@/lib/constants";

/** Far above any real search: Unsplash queries are a few words. Bounded like every request string (ENG-1652). */
export const UNSPLASH_QUERY_MAX_LENGTH = 256;
/** Nine photos a page; nobody clicks "Load more" a thousand times. */
export const UNSPLASH_MAX_PAGE = 1000;
const UNSPLASH_DOWNLOAD_URL_MAX_LENGTH = 2048;

/** `GET /api/internal/unsplash-photos` query: the editor's background image search. */
export const ZUnsplashPhotoSearchQuery = z
  .object({
    query: z.string().min(1).max(UNSPLASH_QUERY_MAX_LENGTH),
    page: z.coerce.number().int().min(1).max(UNSPLASH_MAX_PAGE).default(1),
  })
  .strict();

/** Unsplash's photo download endpoint, `/photos/{id}/download`, as a search result's `download_location` names it. */
const UNSPLASH_DOWNLOAD_PATH = /^\/photos\/[A-Za-z0-9_-]+\/download$/;

/**
 * Whether `value` is an Unsplash download location and nothing else: https, an allowed Unsplash API host on
 * its default port, no credentials, and the download path. The server sends the instance's access key to
 * this URL, so anything looser would hand the key to whatever host a caller names.
 */
export const isUnsplashDownloadUrl = (value: string): boolean => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === "https:" &&
    UNSPLASH_ALLOWED_DOMAINS.includes(url.hostname) &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    UNSPLASH_DOWNLOAD_PATH.test(url.pathname)
  );
};

/** `POST /api/internal/unsplash-photos/downloads` body: the photo the author picked, reported to Unsplash. */
export const ZUnsplashPhotoDownloadBody = z
  .object({
    downloadUrl: z
      .string()
      .max(UNSPLASH_DOWNLOAD_URL_MAX_LENGTH)
      .refine(isUnsplashDownloadUrl, { error: "Invalid Unsplash URL" }),
  })
  .strict();

export type TUnsplashPhotoSearchQuery = z.infer<typeof ZUnsplashPhotoSearchQuery>;
export type TUnsplashPhotoDownloadBody = z.infer<typeof ZUnsplashPhotoDownloadBody>;
