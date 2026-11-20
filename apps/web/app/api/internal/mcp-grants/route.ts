import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listMcpGrantsOperation } from "./lib/operations";

/**
 * `GET /api/internal/mcp-grants`: the session user's MCP clients with their grants, for Authorized
 * apps (ENG-7152). Internal and session-only.
 */
export const GET = withV3ApiWrapper({
  auth: "session",
  handler: async ({ authentication, requestId, instance }) =>
    listMcpGrantsOperation({ authentication, requestId, instance }),
});
