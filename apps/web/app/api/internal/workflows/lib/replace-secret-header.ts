import "server-only";
import { prisma } from "@formbricks/database";
import {
  type TReplaceWorkflowSecretHeaderInput,
  type TWorkflowDefinition,
  type TWorkflowSecretHeaderParams,
  findWorkflowSecretHeader,
  getWorkflowOriginHost,
  getWorkflowUrlOrigin,
  setWorkflowSecretHeaderId,
} from "@formbricks/workflows";
import {
  WorkflowConflictError,
  WorkflowInvalidInputError,
  WorkflowInvalidStateError,
  type WorkflowSecretStore,
  assertNotArchived,
  loadAndAuthorize,
  toProblemResponse,
} from "@formbricks/workflows/server";
import { noContentResponse, problemNotFound } from "@/app/api/v3/lib/response";
import type { TV3AuditLog, TV3Authentication } from "@/app/api/v3/lib/types";
import { buildWorkflowApiContext, workflowsService } from "@/app/api/v3/workflows/lib/context";
import { createWorkflowSecretStore } from "@/modules/ee/workflows/lib/secret-headers/workflow-secret-store";

/**
 * Stores Replace's new value: over the draft's row (in place for the same origin, else in a new row the
 * store returns), over the enabled version's row when it is another row set for this origin
 * (`versionId` is only passed then), or in a new row for a draft header without one. Returns the id the
 * draft's header must point at when that changes.
 */
const storeReplacedValue = async ({
  store,
  write,
  headerName,
  inDraft,
  draftId,
  versionId,
}: {
  store: WorkflowSecretStore;
  write: { workflowId: string; workspaceId: string; value: string; boundOrigin: string };
  headerName: string;
  inDraft: boolean;
  draftId: string | undefined;
  versionId: string | undefined;
}): Promise<string | undefined> => {
  if (draftId) {
    const { id } = await store.replace({ ...write, secretId: draftId });
    if (versionId && versionId !== draftId) await store.replace({ ...write, secretId: versionId });
    return id === draftId ? undefined : id;
  }
  if (versionId) {
    // A draft that re-added the header since Enable shares the enabled version's row again.
    await store.replace({ ...write, secretId: versionId });
    return inDraft ? versionId : undefined;
  }
  if (inDraft) return (await store.create(write)).id;
  throw new WorkflowInvalidStateError(
    `Secret header ${headerName} of the enabled workflow is set for another host than its URL; enter it again in the draft and enable it.`
  );
};

/**
 * `PUT /api/internal/workflows/{workflowId}/steps/{stepId}/secret-headers/{headerName}` (ENG-7179, ADR 0043):
 * Replace on a secret header. The header is looked up by step and name (case-insensitive) in the draft
 * and in the latest version, which is what an enabled workflow runs. The new value is bound to the
 * origin of the step's URL (the draft's, else the version's; ADR 0051). Every stored row they reference
 * that is set for that origin (or set before host binding) is overwritten in place, so the enabled
 * workflow sends the new value from its next run, without a new Enable and without publishing anything
 * else from the draft. A row set for another host is left to it: when the draft moved the step to a new
 * host, the value goes to a new row that only the draft points at, and the enabled version keeps
 * sending its old value to its own host until the draft is enabled. A header with no stored value yet
 * also gets a new row for the draft only: versions are never rewritten.
 *
 * The writes run in one transaction that first checks the workflow is still not archived; the draft is
 * overwritten only if it is still the one read (`updatedAt` compare-and-set), else 409 and nothing is
 * stored, so a concurrent edit is never lost.
 *
 * Write access; archived workflows are read-only; a step without a valid URL can't take a value (400).
 * Audited as `secretHeaderReplaced` (`secretHeaderSet` for a first value) with the step, the header
 * name and the host the value is now bound to; the value reaches only the encrypted store.
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

    const boundOrigin = getWorkflowUrlOrigin(header.stepUrl);
    if (boundOrigin === null) {
      throw new WorkflowInvalidInputError(
        `Enter the step's URL before the value of secret header ${header.name}: a secret is only sent to the host it was entered for.`
      );
    }

    const scope = { workflowId: workflow.id, workspaceId: workflow.workspaceId };
    const draftId = inDraft?.secretId;
    const versionId = inVersion?.secretId;
    if (!draftId && !versionId && !inDraft) {
      // Only reachable for a version enabled without a value, which Enable refuses.
      throw new WorkflowInvalidStateError(
        "This header has no stored value and is not in the draft; add it to the draft and enable it."
      );
    }
    const change: "replaced" | "set" = draftId || versionId ? "replaced" : "set";

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

      // The enabled version's own row, when it isn't the draft's: overwritten only while it is set for
      // this origin, so a version still on another host keeps its value there.
      const versionOrigins = await store.readBoundOrigins({
        ...scope,
        secretIds: versionId ? [versionId] : [],
      });
      const versionOrigin = versionId ? versionOrigins.get(versionId) : undefined;
      const versionInPlace =
        versionId !== undefined && (versionOrigin === null || versionOrigin === boundOrigin);
      const write = { ...scope, value: input.value, boundOrigin };

      const draftTarget = await storeReplacedValue({
        store,
        write,
        headerName: header.name,
        inDraft: inDraft !== null,
        draftId,
        versionId: versionInPlace ? versionId : undefined,
      });
      if (inDraft && draftTarget) await pointDraftAt(inDraft.name, draftTarget);
    });

    if (auditLog && change === "set") auditLog.action = "secretHeaderSet";
    await ctx.recordAudit?.({
      targetId: workflow.id,
      workspaceId: workflow.workspaceId,
      newObject: { stepId: params.stepId, headerName: header.name, host: getWorkflowOriginHost(boundOrigin) },
    });

    return noContentResponse({ requestId });
  } catch (error) {
    return toProblemResponse(error, ctx);
  }
};
