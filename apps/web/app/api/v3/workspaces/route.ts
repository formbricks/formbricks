/**
 * POST /api/v3/workspaces — create a workspace in an organization the caller owns or manages (ADR 0018).
 *
 * Session cookie only: creating a workspace is an organization-level change, and an API key is bound to
 * workspace grants, not to a person with an organization role. The operation enforces the role and the
 * plan's workspace cap itself, so the MCP tool gets the same answers.
 */
import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { createV3Workspace } from "./lib/setup";

export const POST = withV3ApiWrapper({
  auth: "session",
  action: "created",
  targetType: "workspace",
  schemas: {
    query: ZV3EmptyQuery,
    // Parsed by the operation, so the MCP tool that calls it directly gets the same 400.
    body: z.unknown(),
  },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    createV3Workspace({ body: parsedInput.body, authentication, auditLog, requestId, instance }),
});
