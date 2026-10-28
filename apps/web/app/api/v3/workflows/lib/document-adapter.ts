import "server-only";
import { logger } from "@formbricks/logger";
import {
  type TV3DocumentAdapter,
  type TV3DocumentPullParams,
  type TV3DocumentPushParams,
  type TV3DocumentPushResult,
  buildDocumentEnvelope,
  diffDocuments,
  problemStaleDocument,
} from "@/app/api/v3/documents/lib/envelope";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { problemUnprocessableContent, successResponse } from "@/app/api/v3/lib/response";
import { buildWorkflowApiContext, workflowsHandlers } from "./context";
import { parseWorkflowDocument, toDiffView, toWorkflowDocument } from "./document-schema";

/**
 * Pull and push for workflows (ADR 0015). Both run through the workflow handlers (`pullDocument`,
 * `pushDocument` in `@formbricks/workflows`), which own authorization, the lifecycle rules (an archived
 * workflow is read-only, an enabled one keeps its definition), the trigger-survey guard, the write and the
 * audit snapshot with `send_email` PII masked. This file only turns a resource into a document and back.
 * An id from another workspace answers like an unknown one (403), as for every workflow route.
 *
 * Nothing a push could remove is destructive here: the definition is a draft the agent can rewrite, and the
 * rules above already refuse what a workflow must keep. So `confirmDestructive` has nothing to confirm.
 */

const documentLocation = (workflowId: string): string => `/api/v3/workflows/${workflowId}/document`;

const pull = async ({
  id,
  authentication,
  requestId,
  instance,
}: TV3DocumentPullParams): Promise<Response> => {
  const resource = await workflowsHandlers.pullDocument({
    ctx: buildWorkflowApiContext(authentication, requestId, instance ?? documentLocation(id)),
    params: { workflowId: id },
  });
  if (resource instanceof Response) return resource;

  return successResponse(
    buildDocumentEnvelope(
      "workflow",
      { id: resource.id, workspaceId: resource.workspaceId, updatedAt: resource.updatedAt },
      toWorkflowDocument(resource)
    ),
    { requestId }
  );
};

const push = async ({
  id,
  document,
  expectedUpdatedAt,
  dryRun,
  authentication,
  requestId,
  instance,
  auditLog,
}: TV3DocumentPushParams): Promise<Response> => {
  const resolvedInstance = instance ?? documentLocation(id);

  // A dry run is never recorded, whatever it answers. The REST route and the MCP tool already leave it
  // out; this keeps the adapter correct for any caller that passes the wrapper's entry anyway.
  if (dryRun) skipV3AuditLog(auditLog);

  const parsed = parseWorkflowDocument(document);
  if (!parsed.ok) {
    logger
      .withContext({ requestId, workflowId: id })
      .warn({ statusCode: 422, invalidParams: parsed.invalidParams }, "Workflow document failed validation");
    return problemUnprocessableContent(requestId, "The workflow document failed validation", {
      invalid_params: parsed.invalidParams,
      instance: resolvedInstance,
    });
  }

  const outcome = await workflowsHandlers.pushDocument({
    ctx: buildWorkflowApiContext(authentication, requestId, resolvedInstance, dryRun ? undefined : auditLog),
    params: { workflowId: id },
    state: parsed.state,
    expectedUpdatedAt,
    dryRun,
  });
  if (outcome instanceof Response) return outcome;

  if (outcome.kind === "stale") {
    return problemStaleDocument(
      requestId,
      outcome.expectedUpdatedAt,
      outcome.currentUpdatedAt,
      resolvedInstance
    );
  }

  // A push that wrote nothing (unchanged document) has no update to record: the handler set no target on
  // the entry, and a success with an empty entry would be noise in the audit log.
  if (!outcome.written) skipV3AuditLog(auditLog);

  const { before, after } = outcome;
  const result: TV3DocumentPushResult = {
    envelope: buildDocumentEnvelope(
      "workflow",
      { id: after.id, workspaceId: after.workspaceId, updatedAt: after.updatedAt },
      toWorkflowDocument(after)
    ),
    dryRun,
    changes: diffDocuments(toDiffView(toWorkflowDocument(before)), toDiffView(toWorkflowDocument(after))),
  };
  return successResponse(result, { requestId });
};

export const workflowDocumentAdapter: TV3DocumentAdapter = {
  kind: "workflow",
  targetType: "workflow",
  pull,
  push,
};
