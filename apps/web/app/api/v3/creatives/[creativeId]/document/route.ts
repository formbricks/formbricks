/**
 * /api/v3/creatives/{creativeId}/document — pull a creative as one editable document and push it back
 * (ADR 0015). The envelope, the stale-check and the destructive-change rules are shared with surveys and
 * workflows (`documents/lib/envelope.ts`); the workspace is resolved from the creative, and an unknown or
 * inaccessible id answers 403, not 404.
 */
import { ZV3DocumentPushBody } from "@/app/api/v3/documents/lib/envelope";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { creativeDocumentAdapter } from "../../lib/document-adapter";
import { ZV3CreativeIdParams } from "../../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3CreativeIdParams, query: ZV3EmptyQuery },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    creativeDocumentAdapter.pull({
      id: parsedInput.params.creativeId,
      authentication,
      requestId,
      instance,
    }),
});

export const PUT = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "creative",
  schemas: { params: ZV3CreativeIdParams, query: ZV3EmptyQuery, body: ZV3DocumentPushBody },
  handler: async ({ parsedInput, authentication, auditLog, requestId, instance }) => {
    const { dryRun = false, confirmDestructive = false, document, expectedUpdatedAt } = parsedInput.body;
    // A dry run changes nothing, so the wrapper's audit entry for it is dropped rather than queued.
    if (dryRun) skipV3AuditLog(auditLog);

    return creativeDocumentAdapter.push({
      id: parsedInput.params.creativeId,
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
