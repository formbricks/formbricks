import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { recheckLicenseOperation } from "./lib/operations";

/**
 * `POST /api/internal/license-checks?workspaceId=`: ask the license server about this instance's license
 * now, instead of waiting for the cache to expire. Self-hosted only; organization owners and managers.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: z.object({ workspaceId: ZId }).strict() },
  // Its own small bucket: every call reaches the license server.
  customRateLimitConfig: rateLimitConfigs.actions.licenseRecheck,
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    recheckLicenseOperation({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      requestId,
      instance,
    }),
});
