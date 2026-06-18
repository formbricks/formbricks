/**
 * /api/v3/contact-attribute-keys - list a workspace's contact attribute keys (read-only).
 * Session cookie or x-api-key; scope by workspaceId only. Lets API/MCP clients discover the
 * `contactAttributeKey` values referenced by app-survey targeting filters
 * (`targeting.filters[].root.contactAttributeKey`).
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3ContactAttributeKeys } from "./lib/operations";
import { ZV3ContactAttributeKeyListQuery } from "./schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: {
    query: ZV3ContactAttributeKeyListQuery,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) => {
    return await listV3ContactAttributeKeys({
      workspaceId: parsedInput.query.workspaceId,
      limit: parsedInput.query.limit,
      cursor: parsedInput.query.cursor,
      authentication,
      requestId,
      instance,
    });
  },
});
