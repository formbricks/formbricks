/**
 * POST /api/v3/creatives/{creativeId}/restore — bring an archived creative back; as a Draft when it
 * needs a Destination it no longer has.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { restoreV3Creative } from "../../lib/operations";
import { ZV3CreativeIdParams } from "../../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "restored",
  targetType: "creative",
  schemas: { params: ZV3CreativeIdParams, query: ZV3EmptyQuery },
  handler: async ({ parsedInput, authentication, auditLog, requestId, instance }) =>
    restoreV3Creative({
      creativeId: parsedInput.params.creativeId,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
