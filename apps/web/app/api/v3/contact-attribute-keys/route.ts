/**
 * /api/v3/contact-attribute-keys - list a workspace's contact attribute keys (read-only), with
 * server-side search, `dataType`/`type` filters, sorting and an optional total. Session cookie or
 * x-api-key; scope by workspaceId only. Lets API/MCP clients discover the `contactAttributeKey` values
 * referenced by app-survey targeting filters (`targeting.filters[].root.contactAttributeKey`).
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3ContactAttributeKeys } from "./lib/operations";

export const GET = withV3ApiWrapper({
  auth: "both",
  handler: async ({ req, authentication, requestId, instance }) => {
    return await listV3ContactAttributeKeys({
      searchParams: new URL(req.url).searchParams,
      authentication,
      requestId,
      instance,
    });
  },
});
