/**
 * /api/v3/segments - list a workspace's (non-private) segments, searched, sorted and counted on the
 * server. Session cookie or x-api-key; scope by workspaceId only. Contacts-entitlement gated.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3Segments } from "./lib/operations";

export const GET = withV3ApiWrapper({
  auth: "both",
  handler: async ({ req, authentication, requestId, instance }) => {
    return await listV3Segments({
      searchParams: new URL(req.url).searchParams,
      authentication,
      requestId,
      instance,
    });
  },
});
