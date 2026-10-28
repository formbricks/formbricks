/**
 * GET /api/v3/tags — list a workspace's tags with their response counts.
 *
 * Session cookie, API key or OAuth token. Agent-first (ADR 0015): every capability a person had in the
 * app is also reachable by an agent, with the same workspace access checks.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3Tags } from "./lib/operations";
import { ZV3TagListQuery } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3TagListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3Tags({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      requestId,
      instance,
    }),
});
