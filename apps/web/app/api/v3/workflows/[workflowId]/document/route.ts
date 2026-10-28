/**
 * /api/v3/workflows/{workflowId}/document — pull a workflow as one editable document and push it back
 * (ADR 0015). The envelope and the stale-check are shared with surveys and creatives
 * (`documents/lib/envelope.ts`); the workspace is resolved from the workflow, and an unknown or
 * inaccessible id answers 403, not 404.
 */
import { ZWorkflowIdInput } from "@formbricks/workflows";
import { ZV3DocumentPushBody } from "@/app/api/v3/documents/lib/envelope";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { workflowDocumentAdapter } from "../../lib/document-adapter";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    workflowDocumentAdapter.pull({
      id: parsedInput.params.workflowId,
      authentication,
      requestId,
      instance,
    }),
});

export const PUT = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "workflow",
  schemas: { params: ZWorkflowIdInput, body: ZV3DocumentPushBody },
  handler: async ({ parsedInput, authentication, auditLog, requestId, instance }) => {
    const { dryRun = false, confirmDestructive = false, document, expectedUpdatedAt } = parsedInput.body;
    // A dry run changes nothing, so the wrapper's audit entry for it is dropped rather than queued.
    if (dryRun) skipV3AuditLog(auditLog);

    return workflowDocumentAdapter.push({
      id: parsedInput.params.workflowId,
      document,
      expectedUpdatedAt,
      dryRun,
      confirmDestructive,
      authentication,
      auditLog: dryRun ? undefined : auditLog,
      requestId,
      instance,
    });
  },
});
