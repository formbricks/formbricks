/** POST /api/v3/creatives/{creativeId}/archive — set a creative aside; it keeps its status and counts. */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { archiveV3Creative } from "../../lib/operations";
import { ZV3CreativeIdParams } from "../../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "archived",
  targetType: "creative",
  schemas: { params: ZV3CreativeIdParams, query: ZV3EmptyQuery },
  handler: async ({ parsedInput, authentication, auditLog, requestId, instance }) =>
    archiveV3Creative({
      creativeId: parsedInput.params.creativeId,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
