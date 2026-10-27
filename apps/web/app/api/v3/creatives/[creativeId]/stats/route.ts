/** GET /api/v3/creatives/{creativeId}/stats — a creative's daily Impressions and Clicks (ENG-4000). */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getV3CreativeStats } from "../../lib/operations";
import { ZV3CreativeIdParams, ZV3CreativeStatsQuery } from "../../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3CreativeIdParams, query: ZV3CreativeStatsQuery },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    getV3CreativeStats({
      creativeId: parsedInput.params.creativeId,
      query: parsedInput.query,
      authentication,
      requestId,
      instance,
    }),
});
