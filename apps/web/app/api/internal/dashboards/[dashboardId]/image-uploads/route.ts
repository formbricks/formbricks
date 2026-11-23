/**
 * POST /api/internal/dashboards/{dashboardId}/image-uploads — presign the private upload of an image
 * block's file (ENG-7249). Session-only: the app uploads, then saves the returned `fileUrl` in the block.
 *
 * Internal surface: no OpenAPI entry and no stability promise.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  ZDashboardImageUploadBody,
  ZDashboardImageUploadParams,
  createDashboardImageUpload,
} from "../../lib/image-upload";

export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZDashboardImageUploadParams, query: ZV3EmptyQuery, body: ZDashboardImageUploadBody },
  // The storage upload budget every presigned upload spends from.
  customRateLimitConfig: rateLimitConfigs.storage.upload,
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    createDashboardImageUpload({
      dashboardId: parsedInput.params.dashboardId,
      body: parsedInput.body,
      authentication,
      requestId,
      instance,
    }),
});
