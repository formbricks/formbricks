/**
 * /api/v3/action-classes - list a workspace's action classes (read-only).
 * Session cookie or x-api-key; scope by workspaceId only. Lets API/MCP clients discover the
 * action-class ids referenced by app-survey triggers (`distribution.triggers[].actionClassId`).
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3ActionClasses } from "./lib/operations";
import { ZV3ActionClassListQuery } from "./schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: {
    query: ZV3ActionClassListQuery,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) => {
    return await listV3ActionClasses({
      workspaceId: parsedInput.query.workspaceId,
      limit: parsedInput.query.limit,
      cursor: parsedInput.query.cursor,
      authentication,
      requestId,
      instance,
    });
  },
});
