/**
 * PATCH /api/v3/workspaces/{workspaceId} — rename a workspace and set its channel or industry.
 *
 * Session cookie or x-api-key. Organization owners and managers (users), or a `manage` grant on the
 * workspace (API keys), enforced by the operation itself. Branding has its own route.
 */
import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { updateV3Workspace } from "../lib/setup";

const workspaceParamsSchema = z.object({
  workspaceId: z.cuid2(),
});

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "workspace",
  schemas: {
    params: workspaceParamsSchema,
    query: ZV3EmptyQuery,
    // Parsed by the operation, so the MCP tool that calls it directly gets the same 400.
    body: z.unknown(),
  },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    updateV3Workspace({
      workspaceId: parsedInput.params.workspaceId,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
