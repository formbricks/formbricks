import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { searchUnsplashPhotosOperation } from "./lib/operations";
import { ZUnsplashPhotoSearchQuery } from "./schemas";

/**
 * `GET /api/internal/unsplash-photos?query=&page=`: the survey editor's background image search. Per-user
 * `action:unsplash` budget instead of the v3 one, shared with the download report; unaudited (it stores
 * nothing), as the server action it replaces was.
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  customRateLimitConfig: rateLimitConfigs.actions.unsplash,
  schemas: { query: ZUnsplashPhotoSearchQuery },
  handler: async ({ parsedInput, requestId, instance }) =>
    searchUnsplashPhotosOperation({ query: parsedInput.query, context: { requestId, instance } }),
});
