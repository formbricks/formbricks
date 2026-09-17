import "server-only";
import { logger } from "@formbricks/logger";
import { requireV3WorkspaceAccess } from "@/app/api/v3/lib/auth";
import { mapV3ThrownError } from "@/app/api/v3/lib/errors";
import { noContentResponse, problemForbidden, successResponse } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { deleteScopedResponse, deleteScopedResponses, getResponseWorkspaceId } from "./service";

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

type TBatchDeleteParams = {
  workspaceId: string;
  ids: string[];
  authentication: TV3Authentication;
  requestId: string;
  instance?: string;
  auditLog?: TV3AuditLog;
};

/**
 * `POST /api/v3/responses/batch-delete` → 200 `{ data: { deleted } }`.
 *
 * Unlike the single delete, the scope is supplied rather than derived — a batch has no one response to
 * resolve it from, and scope-filtering is only meaningful against a known workspace. That is safe here
 * because the value authorized against and the value filtered by are the same `workspaceId`: they
 * cannot diverge, so a foreign id matches nothing instead of being deleted under a scope the caller
 * does hold. Deriving it from the ids instead would mean authorizing every distinct workspace the batch
 * touches, which contradicts the contract's promise to ignore out-of-scope ids rather than refuse them.
 *
 * A shortfall is not an error: `deleted` is allowed to be lower than `ids.length`, or zero.
 */
export async function batchDeleteV3Responses({
  workspaceId,
  ids,
  authentication,
  requestId,
  instance,
  auditLog,
}: TBatchDeleteParams): Promise<Response> {
  const log = logger.withContext({ requestId, workspaceId });

  try {
    const access = await requireV3WorkspaceAccess(authentication, workspaceId, "manage", requestId, instance);

    if (access instanceof Response) {
      return access;
    }

    const { deleted, deletedIds } = await deleteScopedResponses(ids, { workspaceId });

    if (auditLog) {
      auditLog.organizationId = access.organizationId;
      // Identity only, deliberately. The single delete records the whole row because there is exactly
      // one; a batch of up to 100 would put an unbounded blob in a log line, and the ids are what makes
      // the action reviewable. `requested` is kept alongside `deleted` so a shortfall is legible after
      // the fact rather than looking like a partial failure.
      auditLog.oldObject = { workspaceId, requested: ids.length, deleted, responseIds: deletedIds };
    }

    log.info({ requested: ids.length, deleted }, "V3 responses batch deleted");

    return successResponse({ deleted }, { requestId });
  } catch (error) {
    return mapV3ThrownError(error, {
      log,
      requestId,
      instance: instance ?? "",
      operation: "responses.batchDelete",
    });
  }
}
