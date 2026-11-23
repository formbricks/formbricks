import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { triggerUnsplashPhotoDownloadOperation } from "../lib/operations";
import { ZUnsplashPhotoDownloadBody } from "../schemas";

/**
 * `POST /api/internal/unsplash-photos/downloads`: report a picked photo to Unsplash. Same per-user
 * `action:unsplash` budget as the search; unaudited, as the server action it replaces was.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  customRateLimitConfig: rateLimitConfigs.actions.unsplash,
  schemas: { body: ZUnsplashPhotoDownloadBody },
  handler: async ({ parsedInput, requestId, instance }) =>
    triggerUnsplashPhotoDownloadOperation({ body: parsedInput.body, context: { requestId, instance } }),
});
