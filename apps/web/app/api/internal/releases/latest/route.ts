import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { successResponse } from "@/app/api/v3/lib/response";
import { getLatestStableFbRelease } from "@/modules/workspaces/settings/(setup)/app-connection/lib/github";

/**
 * `GET /api/internal/releases/latest`: the tag of the latest stable Formbricks release, or null when
 * GitHub couldn't say. Cached server-side, so the app shell can ask on every load. Signed-in users only:
 * nobody else is shown the update prompt.
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  handler: async ({ requestId }) =>
    successResponse({ tag: (await getLatestStableFbRelease()) ?? null }, { requestId }),
});
