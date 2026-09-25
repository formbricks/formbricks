/**
 * GET /api/v3/responses/count — how many responses match a filter.
 *
 * Separate from the list's `meta.totalCount` deliberately: this endpoint answers the question
 * without fetching a page, which is what an agent asks most often and what v2 offers no way to do
 * at all. The default stops counting at the cap and says so through `relation`.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { countV3ResponsesOperation } from "../lib/operations";

export const GET = withV3ApiWrapper({
  auth: "both",
  handler: async ({ req, authentication, requestId, instance }) =>
    countV3ResponsesOperation({
      searchParams: new URL(req.url).searchParams,
      authentication,
      requestId,
      instance,
    }),
});
