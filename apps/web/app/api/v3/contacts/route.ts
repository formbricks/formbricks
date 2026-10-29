/**
 * /api/v3/contacts - list a workspace's contacts (read-only), filtered, searched, sorted and counted on
 * the server. Session cookie or x-api-key; scope by workspaceId only. Contacts-entitlement gated.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3Contacts } from "./lib/operations";

export const GET = withV3ApiWrapper({
  auth: "both",
  handler: async ({ req, authentication, requestId, instance }) => {
    return await listV3Contacts({
      searchParams: new URL(req.url).searchParams,
      authentication,
      requestId,
      instance,
    });
  },
});
