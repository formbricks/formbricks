import "server-only";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import {
  noContentResponse,
  problemBadGateway,
  problemServiceUnavailable,
  successResponse,
} from "@/app/api/v3/lib/response";
import { UNSPLASH_ACCESS_KEY } from "@/lib/constants";
import type { TUnsplashPhotoDownloadBody, TUnsplashPhotoSearchQuery } from "../schemas";
import { type TUnsplashPhotoResource, serializeUnsplashPhoto } from "../serializers";

/**
 * The survey editor's Unsplash background picker. Both calls spend the instance's `UNSPLASH_ACCESS_KEY`
 * quota on the caller's behalf, so they need a session and share the per-user `action:unsplash` budget
 * (the route's rate limit), as the server actions they replace did. The key never leaves the server: it
 * goes to Unsplash in the `Authorization` header, never in a URL.
 */

const UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos";
const UNSPLASH_PHOTOS_PER_PAGE = "9";
/** Unsplash answers in well under a second; a hung connection should not hold the request. */
const UNSPLASH_TIMEOUT_MS = 10_000;

type TRequestContext = { requestId: string; instance: string };

// The caller learns only that the picker is off; the variable to set goes to the server log.
const NOT_CONFIGURED = "Unsplash is not configured on this instance.";

const notConfigured = ({ requestId, instance }: TRequestContext): Response => {
  logger.withContext({ requestId }).warn("Unsplash request refused: UNSPLASH_ACCESS_KEY is not set");
  return problemServiceUnavailable(requestId, NOT_CONFIGURED, instance);
};

const ZUnsplashSearchResponse = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      alt_description: z.string().nullable(),
      user: z.object({
        first_name: z.string().nullable(),
        last_name: z.string().nullable(),
        links: z.object({ html: z.string() }),
      }),
      urls: z.object({ regular: z.string() }),
      links: z.object({ download_location: z.string() }),
    })
  ),
});

const callUnsplash = (url: string, accessKey: string) =>
  fetch(url, {
    method: "GET",
    headers: { Authorization: `Client-ID ${accessKey}`, "Accept-Version": "v1" },
    cache: "no-store",
    // Only ever Unsplash's own API: a redirect elsewhere would carry the key along.
    redirect: "error",
    signal: AbortSignal.timeout(UNSPLASH_TIMEOUT_MS),
  });

const upstreamFailure = ({ requestId, instance }: TRequestContext, detail: string, extra: object) => {
  logger.withContext({ requestId }).warn(extra, "Unsplash request failed");
  return problemBadGateway(requestId, detail, instance);
};

/** `GET /api/internal/unsplash-photos?query=&page=`: one page of landscape photos matching the search. */
export async function searchUnsplashPhotosOperation({
  query,
  context,
}: {
  query: TUnsplashPhotoSearchQuery;
  context: TRequestContext;
}): Promise<Response> {
  if (!UNSPLASH_ACCESS_KEY) return notConfigured(context);

  const params = new URLSearchParams({
    query: query.query,
    orientation: "landscape",
    per_page: UNSPLASH_PHOTOS_PER_PAGE,
    page: String(query.page),
  });

  let response: Response;
  try {
    response = await callUnsplash(`${UNSPLASH_SEARCH_URL}?${params}`, UNSPLASH_ACCESS_KEY);
  } catch (error) {
    return upstreamFailure(context, "Unsplash could not be reached. Try again shortly.", { err: error });
  }
  if (!response.ok) {
    return upstreamFailure(context, "Failed to fetch images from Unsplash", { status: response.status });
  }

  const parsed = ZUnsplashSearchResponse.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    return upstreamFailure(context, "Failed to fetch images from Unsplash", { reason: "unexpected_body" });
  }

  const photos: TUnsplashPhotoResource[] = parsed.data.results.map(serializeUnsplashPhoto);
  return successResponse(photos, { requestId: context.requestId });
}

/**
 * `POST /api/internal/unsplash-photos/downloads`: report a picked photo to Unsplash, which its API terms
 * require. The URL is the search result's `download_location`, held to Unsplash's API host and download
 * path by the body schema before the key is sent to it.
 */
export async function triggerUnsplashPhotoDownloadOperation({
  body,
  context,
}: {
  body: TUnsplashPhotoDownloadBody;
  context: TRequestContext;
}): Promise<Response> {
  if (!UNSPLASH_ACCESS_KEY) return notConfigured(context);

  let response: Response;
  try {
    response = await callUnsplash(body.downloadUrl, UNSPLASH_ACCESS_KEY);
  } catch (error) {
    return upstreamFailure(context, "Unsplash could not be reached. Try again shortly.", { err: error });
  }
  if (!response.ok) {
    return upstreamFailure(context, "Failed to download image from Unsplash", { status: response.status });
  }

  return noContentResponse({ requestId: context.requestId });
}
