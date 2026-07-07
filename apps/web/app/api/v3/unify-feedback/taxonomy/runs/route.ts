/**
 * POST /api/v3/unify-feedback/taxonomy/runs — start (or resume) a taxonomy generation run for a field
 * scope. Idempotent per scope on the Hub side. Requires readWrite. Session-only.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { triggerV3TaxonomyRun } from "../lib/operations";
import { ZTriggerRunBody } from "../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: {
    body: ZTriggerRunBody,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    triggerV3TaxonomyRun({
      authentication,
      workspaceId: parsedInput.body.workspaceId,
      directoryId: parsedInput.body.directoryId,
      sourceType: parsedInput.body.sourceType,
      sourceId: parsedInput.body.sourceId,
      fieldId: parsedInput.body.fieldId,
      fieldLabel: parsedInput.body.fieldLabel,
      requestId,
      instance,
    }),
});
