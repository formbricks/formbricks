import "server-only";
import { prisma } from "@formbricks/database";
import {
  type TReplaceWorkflowSecretHeaderInput,
  type TWorkflowDefinition,
  type TWorkflowSecretHeaderParams,
  findWorkflowSecretHeader,
  setWorkflowSecretHeaderId,
} from "@formbricks/workflows";
import {
  WorkflowForbiddenError,
  WorkflowInvalidStateError,
  toProblemResponse,
} from "@formbricks/workflows/server";
import { noContentResponse, problemNotFound } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { workflowSecretStore } from "@/modules/ee/workflows/lib/secret-headers/workflow-secret-store";
import { buildWorkflowApiContext } from "./context";

/**
 * `PUT /api/v3/workflows/{workflowId}/steps/{stepId}/secret-headers/{headerName}` (ENG-7179, ADR 0043):
 * Replace on a secret header. The header is looked up by step and name (case-insensitive) in the draft
 * and in the latest version, which is what an enabled workflow runs. Every stored row they reference is
 * overwritten in place, so the enabled workflow sends the new value from its next run, without a new
 * Enable and without publishing anything else from the draft. A header with no stored value yet gets a
 * new row that only the draft points at: versions are never rewritten, so an enabled version without
 * a value stays as it is until the draft is enabled.
 *
 * Write access; archived workflows are read-only. Audited as `secretHeaderReplaced` (`secretHeaderSet`
 * for a first value) with the step and header name; the value reaches only the encrypted store.
 */
export const replaceWorkflowSecretHeader = async ({
  authentication,
  requestId,
  instance,
  auditLog,
  params,
  input,
}: {
  authentication: TV3Authentication;
  requestId: string;
  instance: string;
  auditLog?: TV3AuditLog;
  params: TWorkflowSecretHeaderParams;
  input: TReplaceWorkflowSecretHeaderInput;
}): Promise<Response> => {
  const ctx = buildWorkflowApiContext(authentication, requestId, instance, auditLog);
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: params.workflowId },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        definition: true,
        versions: { orderBy: { version: "desc" }, take: 1, select: { definition: true } },
      },
    });
    // Unknown and foreign workflows answer alike, as every workflow operation does.
    if (!workflow) throw new WorkflowForbiddenError();
    const authorized = await ctx.authorize(workflow.workspaceId, "readWrite");
    if (authorized instanceof Response) return authorized;
    if (workflow.status === "archived") {
      throw new WorkflowInvalidStateError("Archived workflows are read-only; unarchive before editing.");
    }

    const draft: TWorkflowDefinition = workflow.definition;
    const inDraft = findWorkflowSecretHeader(draft, params.stepId, params.headerName);
    const inVersion = findWorkflowSecretHeader(
      workflow.versions[0]?.definition ?? null,
      params.stepId,
      params.headerName
    );
    const header = inDraft ?? inVersion;
    if (!header) {
      return problemNotFound(requestId, "Secret header", params.headerName, instance);
    }

    const scope = { workflowId: workflow.id, workspaceId: workflow.workspaceId };
    // The draft and the enabled version normally share one row; both are overwritten if they don't.
    const storedIds = [...new Set([inDraft?.secretId, inVersion?.secretId].filter((id) => id !== undefined))];
    let change: "replaced" | "set" = "replaced";
    if (storedIds.length > 0) {
      await Promise.all(
        storedIds.map((secretId) => workflowSecretStore.replace({ ...scope, secretId, value: input.value }))
      );
      // A draft that re-added the header since Enable shares the enabled version's row again.
      if (inDraft && !inDraft.secretId) {
        await prisma.workflow.updateMany({
          where: { id: workflow.id, workspaceId: workflow.workspaceId },
          data: { definition: setWorkflowSecretHeaderId(draft, params.stepId, inDraft.name, storedIds[0]) },
        });
      }
    } else if (inDraft) {
      const { id } = await workflowSecretStore.create({ ...scope, value: input.value });
      await prisma.workflow.updateMany({
        where: { id: workflow.id, workspaceId: workflow.workspaceId },
        data: { definition: setWorkflowSecretHeaderId(draft, params.stepId, inDraft.name, id) },
      });
      change = "set";
    } else {
      // Only reachable for a version enabled without a value, which Enable refuses.
      throw new WorkflowInvalidStateError(
        "This header has no stored value and is not in the draft; add it to the draft and enable it."
      );
    }

    if (auditLog && change === "set") auditLog.action = "secretHeaderSet";
    await ctx.recordAudit?.({
      targetId: workflow.id,
      workspaceId: workflow.workspaceId,
      newObject: { stepId: params.stepId, headerName: header.name },
    });

    return noContentResponse({ requestId });
  } catch (error) {
    return toProblemResponse(error, ctx);
  }
};
