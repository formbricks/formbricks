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
  WorkflowConflictError,
  WorkflowInvalidStateError,
  assertNotArchived,
  loadAndAuthorize,
  toProblemResponse,
} from "@formbricks/workflows/server";
import { noContentResponse, problemNotFound } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { buildWorkflowApiContext, workflowsService } from "@/app/api/v3/workflows/lib/context";
import { createWorkflowSecretStore } from "@/modules/ee/workflows/lib/secret-headers/workflow-secret-store";

/**
 * `PUT /api/internal/workflows/{workflowId}/steps/{stepId}/secret-headers/{headerName}` (ENG-7179, ADR 0043):
 * Replace on a secret header. The header is looked up by step and name (case-insensitive) in the draft
 * and in the latest version, which is what an enabled workflow runs. Every stored row they reference is
 * overwritten in place, so the enabled workflow sends the new value from its next run, without a new
 * Enable and without publishing anything else from the draft. A header with no stored value yet gets a
 * new row that only the draft points at: versions are never rewritten, so an enabled version without
 * a value stays as it is until the draft is enabled.
 *
 * The writes run in one transaction that first checks the workflow is still not archived; the draft is
 * overwritten only if it is still the one read (`updatedAt` compare-and-set), else 409 and nothing is
 * stored, so a concurrent edit is never lost.
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
    // Unknown and foreign workflows answer alike (403), as every workflow operation does.
    const workflow = await loadAndAuthorize(workflowsService, ctx, params.workflowId, "readWrite");
    if (workflow instanceof Response) return workflow;
    assertNotArchived(workflow);

    const latestVersion = await prisma.workflowVersion.findFirst({
      where: { workflowId: workflow.id, workspaceId: workflow.workspaceId },
      orderBy: { version: "desc" },
      select: { definition: true },
    });

    const draft: TWorkflowDefinition = workflow.definition;
    const inDraft = findWorkflowSecretHeader(draft, params.stepId, params.headerName);
    const inVersion = findWorkflowSecretHeader(
      latestVersion?.definition ?? null,
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
    if (storedIds.length === 0 && !inDraft) {
      // Only reachable for a version enabled without a value, which Enable refuses.
      throw new WorkflowInvalidStateError(
        "This header has no stored value and is not in the draft; add it to the draft and enable it."
      );
    }
    const change: "replaced" | "set" = storedIds.length > 0 ? "replaced" : "set";

    await prisma.$transaction(async (tx) => {
      const current = await tx.workflow.findFirst({
        where: { id: scope.workflowId, workspaceId: scope.workspaceId },
        select: { status: true },
      });
      if (!current) throw new WorkflowConflictError("The workflow no longer exists.");
      assertNotArchived(current);

      const store = createWorkflowSecretStore(tx);
      /** Points the draft's header at `secretId`, only if the draft is still the one read. */
      const pointDraftAt = async (headerName: string, secretId: string) => {
        const { count } = await tx.workflow.updateMany({
          where: {
            id: scope.workflowId,
            workspaceId: scope.workspaceId,
            updatedAt: workflow.updatedAt,
            status: { not: "archived" },
          },
          data: { definition: setWorkflowSecretHeaderId(draft, params.stepId, headerName, secretId) },
        });
        if (count === 0) {
          throw new WorkflowConflictError(
            "The workflow changed since it was loaded. Reload it and try again."
          );
        }
      };

      if (storedIds.length > 0) {
        await Promise.all(
          storedIds.map((secretId) => store.replace({ ...scope, secretId, value: input.value }))
        );
        // A draft that re-added the header since Enable shares the enabled version's row again.
        if (inDraft && !inDraft.secretId) await pointDraftAt(inDraft.name, storedIds[0]);
      } else if (inDraft) {
        const { id } = await store.create({ ...scope, value: input.value });
        await pointDraftAt(inDraft.name, id);
      }
    });

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
