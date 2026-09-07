/**
 * GET /api/v3/tags — list a workspace's tags with their response counts.
 *
 * Session-only, deliberately. These endpoints replace `authenticatedActionClient` server actions that
 * only ever ran for a signed-in user, so accepting `x-api-key` here would widen the surface rather than
 * migrate it.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3Tags } from "./lib/operations";
import { ZV3TagListQuery } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZV3TagListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3Tags({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      requestId,
      instance,
    }),
});
