/**
 * /api/v3/surveys/{surveyId}/document — pull a survey as one editable document and push it back
 * (ADR 0015). The envelope, the stale-check and the destructive-change rules are shared with creatives and
 * workflows (`documents/lib/envelope.ts`); an unknown or inaccessible id answers 403, not 404.
 */
import { z } from "zod";
import { ZV3DocumentPushBody } from "@/app/api/v3/documents/lib/envelope";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { ZV3EmptyQuery } from "@/app/api/v3/lib/schemas";
import { surveyDocumentAdapter } from "../../document/adapter";

const surveyParamsSchema = z.object({
  surveyId: z.cuid2(),
});

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: surveyParamsSchema, query: ZV3EmptyQuery },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    surveyDocumentAdapter.pull({
      id: parsedInput.params.surveyId,
      authentication,
      requestId,
      instance,
    }),
});

export const PUT = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "survey",
  schemas: { params: surveyParamsSchema, query: ZV3EmptyQuery, body: ZV3DocumentPushBody },
  handler: async ({ parsedInput, authentication, auditLog, requestId, instance }) => {
    const { dryRun = false, confirmDestructive = false, document, expectedUpdatedAt } = parsedInput.body;
    // A dry run changes nothing, so the wrapper's audit entry for it is dropped rather than queued.
    if (dryRun) skipV3AuditLog(auditLog);

    return surveyDocumentAdapter.push({
      id: parsedInput.params.surveyId,
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
