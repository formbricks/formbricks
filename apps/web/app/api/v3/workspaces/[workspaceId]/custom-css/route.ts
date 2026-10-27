/**
 * /api/v3/workspaces/{workspaceId}/custom-css — read and save the workspace's shared survey CSS (ENG-3641).
 * Session cookie or x-api-key. Reads need workspace read access; writes need an organization owner or
 * manager (users) or a `manage` grant on the workspace (API keys), enforced by the operation itself.
 */
import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { getV3WorkspaceCustomCss, patchV3WorkspaceCustomCss } from "../../lib/custom-css";

const workspaceParamsSchema = z.object({
  workspaceId: z.cuid2(),
});

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: {
    params: workspaceParamsSchema,
    query: ZV3EmptyQuery,
  },
  handler: async ({ parsedInput, authentication, requestId, instance }) => {
    return await getV3WorkspaceCustomCss({
      workspaceId: parsedInput.params.workspaceId,
      authentication,
      requestId,
      instance,
    });
  },
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
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) => {
    return await patchV3WorkspaceCustomCss({
      workspaceId: parsedInput.params.workspaceId,
      body: parsedInput.body,
      authentication,
      requestId,
      instance,
      auditLog,
    });
  },
});
