/**
 * PUT /api/v3/workspaces/{workspaceId}/branding — set the workspace's brand colour and/or logo.
 *
 * Only the fields sent are written. A logo is given as an https URL: the server downloads it behind the
 * webhook SSRF guard, caps its size and type, and stores its own copy. Session cookie or x-api-key, with
 * the same role rules as `PATCH /api/v3/workspaces/{workspaceId}`, enforced by the operation.
 */
import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { setV3WorkspaceBranding } from "../../lib/branding";

const workspaceParamsSchema = z.object({
  workspaceId: z.cuid2(),
});

export const PUT = withV3ApiWrapper({
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
    setV3WorkspaceBranding({
      workspaceId: parsedInput.params.workspaceId,
      body: parsedInput.body,
      authentication,
      auditLog,
      requestId,
      instance,
    }),
});
