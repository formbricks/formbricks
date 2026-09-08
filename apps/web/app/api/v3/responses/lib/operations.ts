import "server-only";
import { logger } from "@formbricks/logger";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { noContentResponse, problemForbidden } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { deleteScopedResponse, getResponseWorkspaceId } from "./service";

type TDeleteParams = {
  responseId: string;
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

/**
 * `DELETE /api/v3/responses/{responseId}` → 204.
 *
 * Returns a `Response` and never throws, because these operations have two callers: the HTTP wrapper,
 * and the MCP server, which calls them directly with no wrapper to catch anything.
 *
 * Permission is `manage`, not `write`. The shipped AuthZed schema assigns `write` to "web-session
 * mutations such as tagging or deleting" and `manage` to "delete through the legacy management APIs", so
 * the API deletes at `manage` — matching v1/v2 and the `deleteV3FeedbackRecord` precedent. The dashboard
 * keeps deleting at `write`; that divergence is deliberate until the Internal API RFC's Wave 3.
 */
export async function deleteV3Response({
  responseId,
  authentication,
  requestId,
  instance,
  auditLog,
}: TDeleteParams): Promise<Response> {
  const log = logger.withContext({ requestId, responseId });

  try {
    const workspaceId = await getResponseWorkspaceId(responseId);

    // A response that does not exist and one in another workspace answer identically. The default detail
    // is what `problemForbidden` and every pre-flight rejection use, so the bodies are byte-identical —
    // asserted as body equality in the tests, because two 403s differing by a word are still an oracle.
    if (!workspaceId) {
      return problemForbidden(requestId, undefined, instance);
    }

    const access = await requireV3WorkspaceAccess(authentication, workspaceId, "manage", requestId, instance);

    if (access instanceof Response) {
      return access;
    }

    const deleted = await deleteScopedResponse(responseId, { workspaceId });

    if (auditLog) {
      auditLog.targetId = responseId;
      auditLog.organizationId = access.organizationId;
      // The deleted content, kept only in the audit trail — the response itself is gone. v1, v2 and
      // `deleteV3FeedbackRecord` all record it; a delete that does not say *what* it destroyed is not
      // reviewable. `redactPII` runs over this before it is persisted.
      auditLog.oldObject = deleted;
    }

    return noContentResponse({ requestId });
  } catch (error) {
    // The service already turned P2025 into `ResourceNotFoundError`, which this renders as the same 403
    // as the pre-flight rejection above — so a response deleted between the scope lookup and the delete
    // is indistinguishable from one that was never the caller's.
    return mapV3ThrownError(error, {
      log,
      requestId,
      instance: instance ?? "",
      operation: "responses.delete",
    });
  }
}
