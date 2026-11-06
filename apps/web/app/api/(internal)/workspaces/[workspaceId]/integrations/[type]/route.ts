import { z } from "zod";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import { can } from "@/lib/authorization";
import { redactIntegrationCredentials } from "@/lib/integration/redact-credentials";
import { getIntegrationByType } from "@/lib/integration/service";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";

/**
 * `GET /api/workspaces/{workspaceId}/integrations/{type}` — the integration behind one integration settings
 * page, so the page can refetch its connection list after a mapping is added, edited or removed (ENG-3981).
 *
 * Internal rather than `/api/v3`: the only callers are the integration settings pages, so it carries no
 * OpenAPI entry and no compatibility promise. Session-only.
 *
 * Same audience as the pages, which redirect read-only members: `workspace.write`. Credentials are redacted
 * exactly as the pages redact them before handing the integration to a client component. `data` is `null`
 * when the workspace has no integration of that type.
 */

const paramsSchema = z.object({
  workspaceId: z.cuid2(),
  // `n8n` is in `ZIntegrationType` but not the database `IntegrationType` enum — no page stores it.
  type: z.enum(["googleSheets", "airtable", "notion", "slack"]),
});

export const GET = withV3ApiWrapper({
  auth: "session",
  action: "queried",
  targetType: "integration",
  schemas: {
    params: paramsSchema,
  },
  handler: async ({ parsedInput, authentication, requestId, instance, auditLog }) => {
    const { workspaceId, type } = parsedInput.params;

    const userId = authentication && "user" in authentication ? authentication.user?.id : undefined;
    // 403 whether the workspace does not exist or the caller may not manage it — a 404 would confirm which
    // workspace ids are real.
    const isAllowed =
      !!userId &&
      (await can({ type: "user", id: userId }, "workspace.write", { type: "workspace", id: workspaceId }));
    if (!isAllowed) {
      return problemForbidden(requestId, undefined, instance);
    }

    const [integration, organizationId] = await Promise.all([
      getIntegrationByType(workspaceId, type),
      getOrganizationIdFromWorkspaceId(workspaceId),
    ]);

    if (auditLog) {
      auditLog.organizationId = organizationId;
      auditLog.targetId = integration?.id ?? workspaceId;
    }

    return successResponse(redactIntegrationCredentials(integration ?? undefined) ?? null, { requestId });
  },
});
