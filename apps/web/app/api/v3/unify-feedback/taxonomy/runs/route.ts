/**
 * POST /api/v3/unify-feedback/taxonomy/runs — start (or resume) a taxonomy generation run for a field
 * scope. Idempotent per scope on the Hub side. Session cookie, API key or OAuth token; changing
 * taxonomy state is limited to organization owners and managers, or to an API key whose workspace owns
 * the directory alone (see `requireUnifyDirectoryMutationAccess`).
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { triggerV3TaxonomyRun } from "../lib/operations";
import { ZTriggerRunBody } from "../lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "feedbackDirectory",
  schemas: {
    body: ZTriggerRunBody,
  },
  handler: async ({ authentication, auditLog, parsedInput, requestId, instance }) =>
    triggerV3TaxonomyRun({
      authentication,
      workspaceId: parsedInput.body.workspaceId,
      directoryId: parsedInput.body.directoryId,
      scopeType: parsedInput.body.scopeType,
      sourceType: parsedInput.body.sourceType,
      sourceId: parsedInput.body.sourceId,
      fieldId: parsedInput.body.fieldId,
      fieldLabel: parsedInput.body.fieldLabel,
      auditLog,
      requestId,
      instance,
    }),
});
